# Quickstart

1. Install the CLI:

   ```bash
   pip install neurodatahub-cli
   ```

2. Find a dataset:

   ```bash
   neurodatahub --list
   neurodatahub search "brain development"
   ```

3. Read its details, then download it:

   ```bash
   neurodatahub info HBN
   neurodatahub --pull HBN --path ./data/HBN
   ```

4. Check that your system has the tools the download needs:

   ```bash
   neurodatahub check
   ```

Commands are from the [CLI README](https://github.com/blackpearl006/neurodatahub-cli).
The CLI README is the source of truth if this page and the CLI disagree.
