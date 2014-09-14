var databaseUrl = "discoveryDB"; 
var collections = ["services"]
var db = require("mongojs").connect(databaseUrl, collections);
var assert = require("assert"),
    NRP = require("node-redis-pubsub-fork"),
    pubsubChannel = new NRP({ scope: "messages" });

var onErr = function(err) {
    console.log(err);
}

pubsubChannel.emit("discovery:bootSuccess", {message: "booted"};

pubsubChannel.on("discovery:getInfo", function(data) {
    db.open(function(err, db) {
        if (!err) {
            db.collection("services", function(err, services) {
                if (!err) {
                    services.find({"name": data.name}).toArray(function(err, servicesRes) {
                        if (!err) {
                            pubsubChannel.emit("discovery:serviceInfo", {"serviceName": data.name, "serviceInfo": servicesRes});
                        } else {onErr(err);}
                    });
                } else {onErr(err);}
            });
        } else {onErr(err);}
    });
});

pubsubChannel.on("discovery:getServices", function() {
    db.open(function(err, db) {
        if (!err) {
            db.collection("services", function(err, services) {
                if (!err) {
                    services.find().toArray(function(err, servicesRes) {
                        if (!err) {
                            pubsubChannel.emit("discovery:services", {"services": servicesRes});
                        } else {onErr(err);}
                    });
                } else {onErr(err);}
            });
        } else {onErr(err);}
    });
});

pubsubChannel.on("deployer:deployResult", function(data) {
    if(data.failed == null) {
        db.services.save({"name": data.name,
                    "url": data.url,
                    "path": data.path,
                    "status": data.status
                        }, function(err, saved) {
          if( err || !saved ) {
              console.log("Service not saved: " + data.name);
          } else {
              console.log("Service saved: " + data.name);
              pubsubChannel.emit("discovery:saved", {name: data.name});
          }
        });
    }
});

pubsubChannel.on("deployer:startResult", update);
pubsubChannel.on("deployer:stopped", update);

function update(data) {
    if(data.failed == null) {
        db.open(function(err, db) {
            db.collection("services").findAndModify(
                { name: data.name },
                [['_id','asc']],
                { $set: { status: data.status,
                          port: data.port,
                          processId: data.processId
                        } },
                function(err, object) {
                    if (err) {
                        console.warn(err.message);
                    } else {
                        pubsubChannel.emit("discovery:updated", {"status":data.status,"name":data.name});
                    }
                }
            );
        });
    }
}

pubsubChannel.on("deployer:deleted", function(data) {
    db.services.remove({ name: data.name
              }, function(err, removed) {
      if( err || !removed ) {
          console.log("Service not removed");
      } else {
          console.log("Service removed");
          pubsubChannel.emit("discovery:removed", {message: "Service removed"});
      }
    });
});
