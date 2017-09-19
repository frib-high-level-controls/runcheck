# This directory contains the tools for importing data into the application
## Summarize
Import lattice data to MongoDB from an xlsx file for runcheck.  Use xlsx (https://github.com/SheetJS/js-xlsx.git) library to read data.

Slot data files are uploaded on trello.com runcheck sprint2 board. There are some format changes from the Original slot file.

The  format of data in each sheet shall like the following:

| systm         |subsytem          | devie         |
| ------------- | ---------------- | ------------- |
| foo           | 123              | abc           |
| bar           | 345              | def           |

The following are the main steps for slot data filter:
  - delete duplicate rows.
  - delete column named 'Distance from Artemis source (m)' in slots data.
  - if type of field is number, delete the unit in field.
  - if specified columns are empty, delete the row.

## Command
```
Usage: node xlsx-mongo <dataPath> <configPath> [options]
  <dataPath>: data file path or name.
  <configPath>: configuration file path or name.
  Options:

    -h, --help              output usage information
    -V, --version           output the version number
    -d, --dryrun            validate data by schema in MongoDB.
    -m, --mongo             save data in default MongoDB.
    -o, --outfile [outfle]  save data in specified file.
    -f, --force             force to save the data that passed validation, whether dry-run is successful or not.
```
## Configuration file
use json format file as configuration. Currently, there are three files available in directory:

*  slot-config.json, for detailed slot data import
*  slot-config2.json, for simple slot data import
*  device-config.json, for device data import

#### Essential attributes
* name
  Data name(slot or device)
* model
  Mongoose data model name
* collection
  collection name in MongoDB
* nameMap
  two-dimensional array, The mapping relation betwwen raw column value in file and > attrbute in data attribute in MongoDB. The column not defined in nameMap would be ommited, for example:
```
  "nameMap": [
    ["serialNo", "FRIB Part Number (w/ SN when applicable)"],
  ]
```
  That means the column, value of which is "FRIB Part Number (w/ SN when applicable)", equals the "serialNo" field in MongoDB.
* position
  Json Objects list, the data position in file, include sheet name and data range. For example:

| systm         |subsytem          | devie         |
| ------------- | ---------------- | ------------- |
| foo           | 123              | abc           |
| bar           | 345              | def           |

  If the table is in Devices sheet, the 'system' is in cell A2, and the 'def' is in cell D66, position should be defined like the following format:
```
  "position":[
    {
      "sheet": "Devices",
      "range": "A2:D66"
```
#### Optional  attributes
* filterField
  String list, if a field is defined in filterField and the field(column) vaue is null, the row of data would be omitted.