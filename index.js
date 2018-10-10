var turf = require('@turf/helpers');
const md5 = require('md5');

const cosines = [];
const sines = [];
for (let i = 0; i < 6; i++) {
    const angle = 2 * Math.PI / 6 * i;
    cosines.push(Math.cos(angle));
    sines.push(Math.sin(angle));
}
const hexagonAngle = 0.523598776; //30 degrees in radians

function getHexBin(feature, cellSize){
    var point = feature.geometry.coordinates;
    var degreesCellSize = (cellSize/1000)/111;
    finalHexRootPoint = getSelectedHexagon(point[1],point[0],degreesCellSize);
    data= hexagon(finalHexRootPoint,degreesCellSize,degreesCellSize,null,cosines,sines);
    return data;
}

//here x and y is inverse, x is latitude and y is longitude
function getSelectedHexagon(x, y, degreesCellSize){
    var xinverse, yinverse = false;
    if(x < 0){
        xinverse = true;
        x = -x;
    }
    if(y < 0){
        yinverse = true;
        y = -y;
    }
    var hexRootPoint = getMoldulusHexagon(x,y,degreesCellSize);
    if(xinverse){
        hexRootPoint[1] = -hexRootPoint[1];
    }
    if(yinverse){
        hexRootPoint[0] = -hexRootPoint[0];
    }
    return hexRootPoint;
}

//here x and y is inverse, x is latitude and y is longitude
function getMoldulusHexagon(x, y, degreesCellSize)
{
    //y = y - (degreesCellSize / 2); //decrease hlaf cellsize because our grid is not starting from 0,0 which is having half hexagon
    var c = Math.sin(hexagonAngle) * degreesCellSize; //height between side length and hex top point
    var gridHeight = degreesCellSize + c;
    var halfWidth = Math.cos(hexagonAngle) * degreesCellSize;
    var gridWidth = halfWidth * 2;

    // Find the row and column of the box that the point falls in.
    var row = Math.floor(y / gridHeight);
    var column;

    if (y < (degreesCellSize / 2)){
        row = -1;
        if(x < halfWidth) {
            column = 0;
        } else {
            column = Math.ceil( (x - halfWidth) / gridWidth);
        }
    } else {
        var rowIsOdd = row % 2 == 1;

        // Is the row an odd number?
        if (rowIsOdd)// Yes: Offset x to match the indent of the row
            column = Math.floor((x - halfWidth) / gridWidth);
        else// No: Calculate normally
            column = Math.floor(x / gridWidth);

        // Work out the position of the point relative to the box it is in
        var relY = y - (row * gridHeight) - (degreesCellSize / 2);//decrease half cellsize because our grid is not starting from 0,0 which is having half hexagon
        var relX;

        if (rowIsOdd) {
            relX = (x - (column * gridWidth)) - halfWidth;
        } else {
            relX = x - (column * gridWidth);
        }

        var m = c / halfWidth;
        if (relY < (-m * relX) + c) // LEFT edge
        {
            row--;
            if (!rowIsOdd && row > 0){
                column--;
            }
        } else if (relY < (m * relX) - c) // RIGHT edge
        {
            row--;
            if (rowIsOdd || row < 0){
                column++;
            }
        }
    }
    //console.log("hexagon row " + row + " , column " + column);

    var lat = (column * gridWidth + ((row % 2) * halfWidth)) + halfWidth;
    var lon = (row * (c + degreesCellSize)) +  c + (degreesCellSize);
    return [lon,lat];
}

/**
 * Creates hexagon
 *
 * @private
 * @param {Array<number>} center of the hexagon
 * @param {number} rx half hexagon width
 * @param {number} ry half hexagon height
 * @param {Object} properties passed to each hexagon
 * @param {Array<number>} cosines precomputed
 * @param {Array<number>} sines precomputed
 * @returns {Feature<Polygon>} hexagon
 */
function hexagon(center, rx, ry, properties, cosines, sines) {
    const vertices = [];
    for (let i = 0; i < 6; i++) {
        const x = center[0] + rx * cosines[i];
        const y = center[1] + ry * sines[i];
        vertices.push([x, y]);
    }
    //first and last vertex must be the same
    vertices.push(vertices[0].slice());
    return turf.polygon([vertices], properties);
}

function calculateHexGrids(features, cellsize, isAddIds){
    var gridMap=[];
    features.forEach(function (feature, i){
      if (feature.geometry.type.toLowerCase() === 'point') {
        var x = getHexBin(feature, cellsize);
        if (x) {
          var gridId = md5(JSON.stringify(x.geometry));
          x.id = gridId;
          if (!x.properties) {
            x.properties = {};
            x.properties['count'] = 0;
          }
          var outGrid = x;
          if (gridMap[gridId]) {
            outGrid = gridMap[gridId];
          } else {
            if (isAddIds) {
              outGrid.properties.ids = new Array();
            }
            gridMap[gridId] = outGrid;
            outGrid.properties.count = 0;
          }
          outGrid.properties.count = outGrid.properties.count + 1;
          if (isAddIds) {
            outGrid.properties.ids.push(feature.id);
          }
          gridMap[gridId] = outGrid;
        } else {
          console.error("something went wrong and hexgrid is not available for feature - " + feature);
          throw new Error("something went wrong and hexgrid is not available for feature - " + feature);
        }
      }
  });
    var hexFeatures=new Array();
    for(var k in gridMap){
        hexFeatures.push(gridMap[k]);
    }
    return hexFeatures;
}

module.exports.getHexBin = getHexBin;
module.exports.calculateHexGrids = calculateHexGrids;
