var databaseUrl = "discoveryDB";
var collections = ["services"]
var db = require("mongojs").connect(databaseUrl, collections);
var assert = require("assert"),
    NRP = require("node-redis-pubsub-fork"),
    pubsubChannel = new NRP({ scope: "messages" });

var timers = require("timers");

var postData = {"name": "testservice",
                "url": "gitlab@git.bskyb.com:sea-microservices/microservices-testservice.git",
                "path": "repos/sea-microservices/microservices-testservice",
                "status": "deployed",
                }

require("../discovery");

after(function(){
    db.services.drop();
});

describe("test discovery: ", function() {

    it("gets messages and stores them", function(done) {
        this.timeout(10000);
        pubsubChannel.emit("deployer:deployResult", postData);
        pubsubChannel.once("discovery:saved", function(data) {
            db.services.find(postData, function(err, result) {
            if( err || !result) console.log("Incorrect service data has been saved");
              else {
                console.log(result);
                done();
              }
            });
        });
    });

    it("allows retrieval of service data", function(done) {
        pubsubChannel.emit("discovery:getInfo", {"name": "testservice"});
        pubsubChannel.on("discovery:serviceInfo", function(data) {
            var result = data.serviceInfo;
            for (var i = 0; i < result.length; i++) {
                delete result[i]["_id"];
                console.log("data:");
                console.log(result);
            }
            if ( equals([postData], result) ) {
                done();
            } else {
                console.log("Incorrect Data: " + JSON.stringify(result));
            }
        });
    });

    it("allows updating of a service", function(done) {
        pubsubChannel.emit("deployer:startResult", {"name": "testservice", "status": "running", "port": "12000", "processId": "12345"});
        timers.setTimeout(function() {
            db.services.find({"name":"testservice"}, function(err, result) {
                if (err || !result) {
                    console.log("No testservice found for test use");
                } else {
                    console.log(result[0].status);
                    if (result[0].status == "running") {
                        done();
                    } else {
                        console.log("Status not running");
                    }
                }
            });
        }, 1000);
    });

    it("allows removal of a service", function(done) {
      this.timeout(5000);
      pubsubChannel.emit("deployer:deployResult", postData);
      pubsubChannel.emit("deployer:deleted", {"name": "testservice"});
      timers.setTimeout(function() {
        db.services.find({"name":"testservice"}, function(err, result) {
            if (err || result.length == 0) {
                console.log("No testservice found, removal successful!");
                done();
              }
              else {
                console.log("fail");
              }
          });
        }, 3000);
    });
});

// Copied from REFERENCE [36] J. Vincent, comment on "Object comparison in JavaScript [duplicate]", StackOverflow, Available: http://stackoverflow.com/questions/1068834/object-comparison- in-javascript
function equals ( x, y ) {
    // If both x and y are null or undefined and exactly the same
    if ( x === y ) {
        return true;
    }

    // If they are not strictly equal, they both need to be Objects
    if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) {
        return false;
    }

    // They must have the exact same prototype chain, the closest we can do is
    // test the constructor.
    if ( x.constructor !== y.constructor ) {
        return false;
    }

    for ( var p in x ) {
        // Inherited properties were tested using x.constructor === y.constructor
        if ( x.hasOwnProperty( p ) ) {
            // Allows comparing x[ p ] and y[ p ] when set to undefined
            if ( ! y.hasOwnProperty( p ) ) {
                return false;
            }

            // If they have the same strict value or identity then they are equal
            if ( x[ p ] === y[ p ] ) {
                continue;
            }

            // Numbers, Strings, Functions, Booleans must be strictly equal
            if ( typeof( x[ p ] ) !== "object" ) {
                return false;
            }

            // Objects and Arrays must be tested recursively
            if ( !equals( x[ p ],  y[ p ] ) ) {
                return false;
            }
        }
    }

    for ( p in y ) {
        // allows x[ p ] to be set to undefined
        if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) ) {
            return false;
        }
    }
    return true;
}
