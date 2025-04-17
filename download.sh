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