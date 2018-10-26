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
    var row;
    var column;

    if (y < (degreesCellSize / 2)){
        row = -1;
        if(x < halfWidth) {
            column = 0;
        } else {
            column = Math.ceil( (x - halfWidth) / gridWidth);
        }
    } else {
        y = y - (degreesCellSize / 2);
        row = Math.floor(y / gridHeight);
        var rowIsOdd = row % 2 == 1;

        // Is the row an odd number?
        if (rowIsOdd)// Yes: Offset x to match the indent of the row
            column = Math.floor((x - halfWidth) / gridWidth);
        else// No: Calculate normally
            column = Math.floor(x / gridWidth);

        // Work out the position of the point relative to the box it is in
        var relY = y - (row * gridHeight) //- (degreesCellSize / 2);//decrease half cellsize because our grid is not starting from 0,0 which is having half hexagon
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
    var feature = turf.polygon([vertices], properties);
    feature.properties.centroid = center;
    return feature;
}

function calculateHexGrids(features, cellsize, isAddIds, groupByProperty){
    var gridMap=[];
    let maxCount = 0;
    //let minCount = Number.MAX_SAFE_INTEGER;
    let groupPropertyCount = {};
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
          if(outGrid.properties.count > maxCount){
            maxCount = outGrid.properties.count;
          }
          /* 
          if(outGrid.properties.count < minCount){
            minCount = outGrid.properties.count;
          }*/
          if (isAddIds) {
            outGrid.properties.ids.push(feature.id);
          }

          //GroupBy property logic
          //console.log(groupByProperty);
          if(groupByProperty){
            let propertyValue = feature.properties[groupByProperty];
            console.log(propertyValue);
            if (groupPropertyCount[propertyValue] == null || groupPropertyCount[propertyValue].maxCount == null) {
                groupPropertyCount[propertyValue] = {};
                groupPropertyCount[propertyValue].maxCount = 0;
            }
            if(outGrid.properties.subcount == null) {
                outGrid.properties.subcount = {};
            }
            if(outGrid.properties.subcount[propertyValue] == null){
                outGrid.properties.subcount[propertyValue] = {};
                outGrid.properties.subcount[propertyValue].count = 0;
            }
            outGrid.properties.subcount[propertyValue].count++;
            if(outGrid.properties.subcount[propertyValue].count > groupPropertyCount[propertyValue].maxCount){
                groupPropertyCount[propertyValue].maxCount = outGrid.properties.subcount[propertyValue].count;
            }
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
        var feature = gridMap[k];
        //feature.properties.minCount = minCount;
        feature.properties.maxCount = maxCount;
        feature.properties.occupancy = feature.properties.count/maxCount;
        feature.properties.color = "hsla(" + (200 - (feature.properties.occupancy*100*2))  + ", 100%, 50%,0.51)";
        hexFeatures.push(feature);
        if(groupByProperty){
            for (const key of Object.keys(feature.properties.subcount)) {
                feature.properties.subcount[key].maxCount = groupPropertyCount[key].maxCount;
                feature.properties.subcount[key].occupancy = feature.properties.subcount[key].count/groupPropertyCount[key].maxCount;
                feature.properties.subcount[key].color = "hsla(" + (200 - (feature.properties.subcount[key].occupancy*100*2))  + ", 100%, 50%,0.51)";
                console.log(key, JSON.stringify(feature.properties.subcount[key]));
            }
        }
    }
    return hexFeatures;
}

/** 
//var point = [13.4015825,52.473507];
var point = [
    //13.4015825,52.473507
    //0.4015825,0.473507
    //13.401877284049988,
    //      52.473625332625154
    //13.401110172271729,
    //      52.47341620511857
    //13.401729762554169,
    //      52.47346521946711
    0.003519058227539062,
          0.0005149841308648958
];
let feature = {'geometry':{'coordinates':point,'type':'Point'},'properties':{},'type':'Feature'};
//console.log(feature);
var result = getHexBin(feature,100);
//console.log(JSON.stringify(result));
var features = [];
features.push(feature);
features.push(result);
var featureCollection = {'type':'FeatureCollection','features':features};
console.log(JSON.stringify(featureCollection, null, 2));
*/
module.exports.getHexBin = getHexBin;
module.exports.calculateHexGrids = calculateHexGrids;
