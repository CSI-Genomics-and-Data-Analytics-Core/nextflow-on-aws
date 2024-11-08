#! /bin/bash

if ! hash python; then
    echo "python is not installed"
    exit 1
fi

rm -rf ./dist && mkdir ./dist
python -m pip install -r requirements.txt --target ./dist && (cd ./dist && zip -r ./wes_adapter.zip .)
zip -gr ./dist/wes_adapter.zip ./rest_api ./amazon_genomics ./index.py
mv ./dist/wes_adapter.zip ./
