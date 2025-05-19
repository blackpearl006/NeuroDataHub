#!/bin/bash

# Download the IXI dataset
aria2c -x 10 -j 10 -s 10 http://biomedic.doc.ic.ac.uk/brain-development/downloads/IXI/IXI-T1.tar

# Download the OASIS-1 dataset
for i in {1..12}
do
    aria2c -x 10 -j 10 -s 10 https://download.nrg.wustl.edu/data/oasis_cross-sectional_disc$i.tar.gz 
done

# Download the OASIS-2 dataset
aria2c -x 10 -j 10 -s 10 https://download.nrg.wustl.edu/data/OAS2_RAW_PART1.tar.gz
aria2c -x 10 -j 10 -s 10 https://download.nrg.wustl.edu/data/OAS2_RAW_PART2.tar.gz

# Download AOMIC-ID1000 data
aws s3 sync --no-sign-request s3://openneuro.org/ds003097 . --exclude "*" --include "sub-*/anat/*T1w*"

# Download AOMIC-PIOP1 data
aws s3 sync --no-sign-request s3://openneuro.org/ds002790 . --exclude "*" --include "sub-*/anat/*T1w*"

# Download AOMIC-PIOP2 data
aws s3 sync --no-sign-request s3://openneuro.org/ds002785 . --exclude "*" --include "sub-*/anat/*T1w*"

# Download MPI-brain body data
aws s3 sync --no-sign-request s3://openneuro.org/ds000221/ . --exclude * --include "**/*T1w.nii.gz"

