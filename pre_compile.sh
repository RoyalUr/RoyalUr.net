#!/bin/bash

rsync -azP --delete-after ../../Java/RoyalUrAnalysis/target/bytecoder/ res/royal_ur_analysis/
cp -f res/royal_ur_analysis/localedata.properties res/royal_ur_analysis/localedata_US.properties
cp -f res/royal_ur_analysis/localedata.properties res/royal_ur_analysis/localedata_US_en.properties
