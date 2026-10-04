#!/usr/bin/env python3
"""Build the compact 3D brain used by the animated hero on the landing page.

The hero (docs/js/hero-brain.js) shows the same Brainnetome-246 glass brain as
the NeuroAI paper template, but the template's mesh is 6.4 MB. This script
shrinks it to ~115 KB so the hero costs about as much bandwidth as a picture:

  1. read the per-region meshes (nodes named roi_001 ... roi_246) from the
     template's atlas.glb,
  2. simplify every region to ~10% of its triangles (fast-simplification),
  3. quantise, delta-code and gzip everything into docs/assets/hero/brain.bin.gz.

It also checks that every region id used in docs/assets/hero/findings.json
exists, and prints the region names so the mapping can be reviewed.

Usage (developer-only; the website itself needs no build step):

    pip install numpy fast-simplification
    python3 scripts/build_hero_brain.py \
        --src   ../neuroai-template-demo/public/assets/meshes/atlas.glb \
        --atlas ../neuroai-template-demo/public/assets/atlases/brainnetome.json

The atlas.glb comes from https://github.com/blackpearl006/neuroai-template-demo
(Brainnetome atlas: Fan et al. 2016, Cerebral Cortex).

Output format (all little-endian, the whole file gzipped):

    header   32 bytes  magic "NDHB", u16 version, u16 nRegions, u32 nVerts,
                       u32 nTris, f32[3] origin (mm), f32 step (mm per unit)
    regions  nRegions x u32[4]  vertexStart, vertexCount, triStart, triCount
                       (row i describes Brainnetome region id i + 1)
    vertices for x, y, z: zig-zag delta of the quantised coordinate, stored as
                       a plane of low bytes followed by a plane of high bytes
    indices  "high-watermark" codes (0 = next new vertex, k = vertex
                       (newest - k)), low-byte plane then high-byte plane
"""

import argparse
import gzip
import json
import struct
import sys
from pathlib import Path

import numpy as np

try:
    import fast_simplification
except ImportError:  # pragma: no cover - developer hint
    sys.exit("Missing dependency: pip install numpy fast-simplification")

ROOT = Path(__file__).resolve().parent.parent
MAGIC = b"NDHB"
VERSION = 1
GLTF_DTYPES = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}
GLTF_WIDTH = {"SCALAR": 1, "VEC3": 3}


def read_regions(glb_path):
    """Return {region_id: (vertices float64[N,3], faces int64[M,3])} from a .glb."""
    data = Path(glb_path).read_bytes()
    if data[:4] != b"glTF":
        sys.exit(f"{glb_path} is not a binary glTF file")
    json_len = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + json_len])
    bin_start = 20 + json_len + 8  # skip the BIN chunk header

    def accessor(index):
        acc = gltf["accessors"][index]
        view = gltf["bufferViews"][acc["bufferView"]]
        width = GLTF_WIDTH[acc["type"]]
        offset = bin_start + view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        arr = np.frombuffer(data, GLTF_DTYPES[acc["componentType"]], acc["count"] * width, offset)
        return arr.reshape(-1, width) if width > 1 else arr

    regions = {}
    for node in gltf["nodes"]:
        name = node.get("name", "")
        if not (name.startswith("roi_") and "mesh" in node):
            continue
        if any(k in node for k in ("matrix", "translation", "rotation", "scale")):
            sys.exit(f"{name} has a node transform; this script expects vertices in MNI mm")
        prim = gltf["meshes"][node["mesh"]]["primitives"][0]
        verts = accessor(prim["attributes"]["POSITION"]).astype(np.float64)
        faces = accessor(prim["indices"]).reshape(-1, 3).astype(np.int64)
        regions[int(name[4:])] = (verts, faces)
    return regions


def taubin_smooth(verts, faces, iterations, lam=0.5, mu=-0.53):
    """Smooth away the voxel staircase of the atlas surfaces without shrinking them."""
    edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    edges = np.unique(np.sort(edges, axis=1), axis=0)
    degree = np.bincount(edges.ravel(), minlength=len(verts)).astype(np.float64)[:, None]
    verts = verts.copy()
    for _ in range(iterations):
        for factor in (lam, mu):
            neighbours = np.zeros_like(verts)
            np.add.at(neighbours, edges[:, 0], verts[edges[:, 1]])
            np.add.at(neighbours, edges[:, 1], verts[edges[:, 0]])
            verts += factor * (neighbours / np.maximum(degree, 1) - verts)
    return verts


def simplify_regions(regions, reduction, min_tris, smooth):
    """Simplify each region and concatenate them into one region-contiguous mesh.

    Vertices are renumbered in order of first use by the index buffer, which is
    what makes the delta / high-watermark coding below compress well.
    """
    verts_out, faces_out, table = [], [], []
    v_off = t_off = 0
    for rid in range(1, max(regions) + 1):
        if rid not in regions:
            sys.exit(f"Region roi_{rid:03d} is missing from the source mesh")
        verts, faces = regions[rid]
        if smooth:
            verts = taubin_smooth(verts, faces, smooth)
        target = min(reduction, max(0.0, 1.0 - min_tris / len(faces)))
        v2, f2 = fast_simplification.simplify(verts, faces, target_reduction=target)
        v2, f2 = np.asarray(v2), np.asarray(f2, np.int64)
        # The renderer culls back faces, so make sure triangles wind outward (CCW).
        rel = v2 - v2.mean(axis=0)
        if np.einsum("ij,ij->i", rel[f2[:, 0]], np.cross(rel[f2[:, 1]], rel[f2[:, 2]])).sum() < 0:
            f2 = f2[:, [0, 2, 1]]
        flat = f2.ravel()
        _, first_pos = np.unique(flat, return_index=True)
        used = flat[np.sort(first_pos)]  # vertex ids in order of first use
        remap = np.full(len(v2), -1, np.int64)
        remap[used] = np.arange(len(used))
        verts_out.append(v2[used])
        faces_out.append(remap[f2] + v_off)
        table.append((v_off, len(used), t_off, len(f2)))
        v_off += len(used)
        t_off += len(f2)
    return np.concatenate(verts_out), np.concatenate(faces_out), table


def byte_planes(values):
    """uint16-range array -> low-byte plane + high-byte plane (gzip-friendly)."""
    values = np.asarray(values, np.uint32)
    if values.size and values.max() > 0xFFFF:
        sys.exit("Value out of 16-bit range; lower the vertex count")
    return (values & 0xFF).astype(np.uint8).tobytes() + (values >> 8).astype(np.uint8).tobytes()


def encode(verts, faces, table, step):
    origin = verts.min(axis=0)
    quant = np.round((verts - origin) / step).astype(np.int64)
    deltas = np.diff(np.vstack([np.zeros((1, 3), np.int64), quant]), axis=0)
    zigzag = (deltas << 1) ^ (deltas >> 63)

    flat = faces.ravel()
    codes = np.empty_like(flat)
    newest = 0
    for i, v in enumerate(flat):
        if v == newest:
            codes[i] = 0
            newest += 1
        else:
            codes[i] = newest - v

    out = bytearray(struct.pack("<4sHHII3ff", MAGIC, VERSION, len(table), len(verts), len(faces),
                                *origin.astype(np.float32), step))
    for row in table:
        out += struct.pack("<4I", *row)
    for axis in range(3):
        out += byte_planes(zigzag[:, axis])
    out += byte_planes(codes)
    return bytes(out), origin


def decode(buf):
    """Reference decoder (mirrors docs/js/hero-brain.js) used to self-check the output."""
    magic, version, n_regions, n_verts, n_tris, ox, oy, oz, step = struct.unpack_from("<4sHHII3ff", buf, 0)
    assert magic == MAGIC and version == VERSION
    off = 32 + n_regions * 16
    planes = np.frombuffer(buf, np.uint8, offset=off)
    verts = np.empty((n_verts, 3))
    for axis, base in enumerate((ox, oy, oz)):
        lo = planes[2 * axis * n_verts:(2 * axis + 1) * n_verts].astype(np.int64)
        hi = planes[(2 * axis + 1) * n_verts:(2 * axis + 2) * n_verts].astype(np.int64)
        z = lo | (hi << 8)
        verts[:, axis] = base + np.cumsum((z >> 1) ^ -(z & 1)) * step
    idx_planes = planes[6 * n_verts:]
    n_idx = 3 * n_tris
    codes = idx_planes[:n_idx].astype(np.int64) | (idx_planes[n_idx:2 * n_idx].astype(np.int64) << 8)
    flat = np.empty(n_idx, np.int64)
    newest = 0
    for i, c in enumerate(codes):
        if c == 0:
            flat[i] = newest
            newest += 1
        else:
            flat[i] = newest - c
    return verts, flat.reshape(-1, 3)


def check_findings(findings_path, n_regions, atlas_path):
    names = {}
    if atlas_path and Path(atlas_path).exists():
        names = {r["id"]: r["name"] for r in json.loads(Path(atlas_path).read_text())["regions"]}
    findings = json.loads(Path(findings_path).read_text())["findings"]
    ok = True
    for f in findings:
        ids = list(f["regions"]) + [f.get("anchor", f["regions"][0])]
        bad = [i for i in ids if not (1 <= i <= n_regions)]
        if bad:
            ok = False
            print(f"  ✗ {f['id']}: unknown region ids {bad}")
        else:
            label = ", ".join(f"{i}:{names.get(i, '?')}" for i in f["regions"])
            print(f"  ✓ {f['id']} ({f['region']}) → {label}; anchor {f.get('anchor', f['regions'][0])}")
    return ok


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--src", default=str(ROOT.parent / "neuroai-template-demo/public/assets/meshes/atlas.glb"),
                        help="Brainnetome atlas.glb from the NeuroAI template")
    parser.add_argument("--atlas", default=str(ROOT.parent / "neuroai-template-demo/public/assets/atlases/brainnetome.json"),
                        help="optional brainnetome.json, only used to print region names")
    parser.add_argument("--findings", default=str(ROOT / "docs/assets/hero/findings.json"))
    parser.add_argument("--out", default=str(ROOT / "docs/assets/hero/brain.bin.gz"))
    parser.add_argument("--reduction", type=float, default=0.9, help="fraction of triangles to remove per region")
    parser.add_argument("--min-tris", type=int, default=48, help="never simplify a region below this many triangles")
    parser.add_argument("--smooth", type=int, default=10, help="Taubin smoothing iterations before simplifying")
    parser.add_argument("--step", type=float, default=0.1, help="quantisation step in mm")
    parser.add_argument("--max-kb", type=float, default=200, help="fail if the gzipped output is larger than this")
    args = parser.parse_args()

    regions = read_regions(args.src)
    verts, faces, table = simplify_regions(regions, args.reduction, args.min_tris, args.smooth)
    if len(verts) > 0xFFFF:
        sys.exit(f"{len(verts)} vertices exceed 16-bit indices; raise --reduction")
    raw, _ = encode(verts, faces, table, args.step)

    dec_verts, dec_faces = decode(raw)
    assert np.array_equal(dec_faces, faces), "index round-trip failed"
    assert np.abs(dec_verts - verts).max() <= args.step, "vertex round-trip failed"

    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(packed)
    src_tris = sum(len(f) for _, f in regions.values())
    print(f"{len(regions)} regions: {src_tris:,} → {len(faces):,} triangles, {len(verts):,} vertices")
    print(f"wrote {out.relative_to(ROOT)}: {len(packed) / 1024:.1f} KB gzipped ({len(raw) / 1024:.1f} KB raw)")

    if Path(args.findings).exists():
        print("findings:")
        if not check_findings(args.findings, len(table), args.atlas):
            sys.exit("findings.json references unknown regions")
    if len(packed) / 1024 > args.max_kb:
        sys.exit(f"output exceeds the {args.max_kb:.0f} KB budget; raise --reduction")


if __name__ == "__main__":
    main()
