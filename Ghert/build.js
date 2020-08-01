(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/* global THREE */

var INITIALIZING = 0;
var BUFFERING = 1;
var PLAYING = 2;

var MODE_LERP = 0;
var MODE_HERMITE = 1;

var vectorPool = [];
var quatPool = [];
var framePool = [];

var getPooledVector = function getPooledVector() {
  return vectorPool.shift() || new THREE.Vector3();
};
var getPooledQuaternion = function getPooledQuaternion() {
  return quatPool.shift() || new THREE.Quaternion();
};

var getPooledFrame = function getPooledFrame() {
  var frame = framePool.pop();

  if (!frame) {
    frame = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), scale: new THREE.Vector3(), quaternion: new THREE.Quaternion(), time: 0 };
  }

  return frame;
};

var freeFrame = function freeFrame(f) {
  return framePool.push(f);
};

var InterpolationBuffer = function () {
  function InterpolationBuffer() {
    var mode = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : MODE_LERP;
    var bufferTime = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0.15;

    _classCallCheck(this, InterpolationBuffer);

    this.state = INITIALIZING;
    this.buffer = [];
    this.bufferTime = bufferTime * 1000;
    this.time = 0;
    this.mode = mode;

    this.originFrame = getPooledFrame();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3(1, 1, 1);
  }

  _createClass(InterpolationBuffer, [{
    key: "hermite",
    value: function hermite(target, t, p1, p2, v1, v2) {
      var t2 = t * t;
      var t3 = t * t * t;
      var a = 2 * t3 - 3 * t2 + 1;
      var b = -2 * t3 + 3 * t2;
      var c = t3 - 2 * t2 + t;
      var d = t3 - t2;

      target.copy(p1.multiplyScalar(a));
      target.add(p2.multiplyScalar(b));
      target.add(v1.multiplyScalar(c));
      target.add(v2.multiplyScalar(d));
    }
  }, {
    key: "lerp",
    value: function lerp(target, v1, v2, alpha) {
      target.lerpVectors(v1, v2, alpha);
    }
  }, {
    key: "slerp",
    value: function slerp(target, r1, r2, alpha) {
      THREE.Quaternion.slerp(r1, r2, target, alpha);
    }
  }, {
    key: "updateOriginFrameToBufferTail",
    value: function updateOriginFrameToBufferTail() {
      freeFrame(this.originFrame);
      this.originFrame = this.buffer.shift();
    }
  }, {
    key: "appendBuffer",
    value: function appendBuffer(position, velocity, quaternion, scale) {
      var tail = this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : null;
      // update the last entry in the buffer if this is the same frame
      if (tail && tail.time === this.time) {
        if (position) {
          tail.position.copy(position);
        }

        if (velocity) {
          tail.velocity.copy(velocity);
        }

        if (quaternion) {
          tail.quaternion.copy(quaternion);
        }

        if (scale) {
          tail.scale.copy(scale);
        }
      } else {
        var priorFrame = tail || this.originFrame;
        var newFrame = getPooledFrame();
        newFrame.position.copy(position || priorFrame.position);
        newFrame.velocity.copy(velocity || priorFrame.velocity);
        newFrame.quaternion.copy(quaternion || priorFrame.quaternion);
        newFrame.scale.copy(scale || priorFrame.scale);
        newFrame.time = this.time;

        this.buffer.push(newFrame);
      }
    }
  }, {
    key: "setTarget",
    value: function setTarget(position, velocity, quaternion, scale) {
      this.appendBuffer(position, velocity, quaternion, scale);
    }
  }, {
    key: "setPosition",
    value: function setPosition(position, velocity) {
      this.appendBuffer(position, velocity, null, null);
    }
  }, {
    key: "setQuaternion",
    value: function setQuaternion(quaternion) {
      this.appendBuffer(null, null, quaternion, null);
    }
  }, {
    key: "setScale",
    value: function setScale(scale) {
      this.appendBuffer(null, null, null, scale);
    }
  }, {
    key: "update",
    value: function update(delta) {
      if (this.state === INITIALIZING) {
        if (this.buffer.length > 0) {
          this.updateOriginFrameToBufferTail();
          this.position.copy(this.originFrame.position);
          this.quaternion.copy(this.originFrame.quaternion);
          this.scale.copy(this.originFrame.scale);
          this.state = BUFFERING;
        }
      }

      if (this.state === BUFFERING) {
        if (this.buffer.length > 0 && this.time > this.bufferTime) {
          this.state = PLAYING;
        }
      }

      if (this.state === PLAYING) {
        var mark = this.time - this.bufferTime;
        //Purge this.buffer of expired frames
        while (this.buffer.length > 0 && mark > this.buffer[0].time) {
          //if this is the last frame in the buffer, just update the time and reuse it
          if (this.buffer.length > 1) {
            this.updateOriginFrameToBufferTail();
          } else {
            this.originFrame.position.copy(this.buffer[0].position);
            this.originFrame.velocity.copy(this.buffer[0].velocity);
            this.originFrame.quaternion.copy(this.buffer[0].quaternion);
            this.originFrame.scale.copy(this.buffer[0].scale);
            this.originFrame.time = this.buffer[0].time;
            this.buffer[0].time = this.time + delta;
          }
        }
        if (this.buffer.length > 0 && this.buffer[0].time > 0) {
          var targetFrame = this.buffer[0];
          var delta_time = targetFrame.time - this.originFrame.time;
          var alpha = (mark - this.originFrame.time) / delta_time;

          if (this.mode === MODE_LERP) {
            this.lerp(this.position, this.originFrame.position, targetFrame.position, alpha);
          } else if (this.mode === MODE_HERMITE) {
            this.hermite(this.position, alpha, this.originFrame.position, targetFrame.position, this.originFrame.velocity.multiplyScalar(delta_time), targetFrame.velocity.multiplyScalar(delta_time));
          }

          this.slerp(this.quaternion, this.originFrame.quaternion, targetFrame.quaternion, alpha);

          this.lerp(this.scale, this.originFrame.scale, targetFrame.scale, alpha);
        }
      }

      if (this.state !== INITIALIZING) {
        this.time += delta;
      }
    }
  }, {
    key: "getPosition",
    value: function getPosition() {
      return this.position;
    }
  }, {
    key: "getQuaternion",
    value: function getQuaternion() {
      return this.quaternion;
    }
  }, {
    key: "getScale",
    value: function getScale() {
      return this.scale;
    }
  }]);

  return InterpolationBuffer;
}();

module.exports = InterpolationBuffer;

},{}],2:[function(require,module,exports){
class ChildEntityCache {

  constructor() {
    this.dict = {};
  }

  addChild(parentNetworkId, childData) {
    if (!this.hasParent(parentNetworkId)) {
      this.dict[parentNetworkId] = [];
    }
    this.dict[parentNetworkId].push(childData);
  }

  getChildren(parentNetworkId) {
    if (!this.hasParent(parentNetworkId)) {
      return [];
    }
    var children = this.dict[parentNetworkId];
    delete this.dict[parentNetworkId];
    return children;
  }

  /* Private */
  hasParent(parentId) {
    return !!this.dict[parentId];
  }
}
module.exports = ChildEntityCache;
},{}],3:[function(require,module,exports){
// Patched version of fast-deep-equal which does not
// allocate memory via calling Object.keys
//
// https://github.com/epoberezkin/fast-deep-equal/blob/master/index.js
'use strict';

var isArray = Array.isArray;
var keyList = Object.keys;
var hasProp = Object.prototype.hasOwnProperty;

module.exports = function equal(a, b) {
  if (a === b) return true;

  if (a && b && typeof a == 'object' && typeof b == 'object') {
    var arrA = isArray(a)
      , arrB = isArray(b)
      , i
      , length
      , key;

    if (arrA && arrB) {
      length = a.length;
      if (length != b.length) return false;
      for (i = length; i-- !== 0;)
        if (!equal(a[i], b[i])) return false;
      return true;
    }

    if (arrA != arrB) return false;

    var dateA = a instanceof Date
      , dateB = b instanceof Date;
    if (dateA != dateB) return false;
    if (dateA && dateB) return a.getTime() == b.getTime();

    var regexpA = a instanceof RegExp
      , regexpB = b instanceof RegExp;
    if (regexpA != regexpB) return false;
    if (regexpA && regexpB) return a.toString() == b.toString();

    var keys = keyList(a);
    length = keys.length;

    if (length !== keyList(b).length)
      return false;

    for (i = length; i-- !== 0;)
      if (!hasProp.call(b, keys[i])) return false;

    for (i = length; i-- !== 0;) {
      key = keys[i];
      if (!equal(a[key], b[key])) return false;
    }

    return true;
  }

  return a!==a && b!==b;
};

},{}],4:[function(require,module,exports){
var options = require('./options');
var utils = require('./utils');
var NafLogger = require('./NafLogger');
var Schemas = require('./Schemas');
var NetworkEntities = require('./NetworkEntities');
var NetworkConnection = require('./NetworkConnection');
var AdapterFactory = require('./adapters/AdapterFactory');

var naf = {};
naf.app = '';
naf.room = '';
naf.clientId = '';
naf.options = options;
naf.utils = utils;
naf.log = new NafLogger();
naf.schemas = new Schemas();
naf.version = "0.7.1";

naf.adapters = new AdapterFactory();
var entities = new NetworkEntities();
var connection = new NetworkConnection(entities);
naf.connection = connection;
naf.entities = entities;

module.exports = window.NAF = naf;

},{"./NafLogger":5,"./NetworkConnection":6,"./NetworkEntities":7,"./Schemas":8,"./adapters/AdapterFactory":9,"./options":16,"./utils":17}],5:[function(require,module,exports){
/*eslint no-console: "off" */

class NafLogger {

  constructor() {
    this.debug = false;
  }

  setDebug(debug) {
    this.debug = debug;
  }

  write() {
    if (this.debug) {
      console.log.apply(this, arguments);
    }
  }

  warn() {
    console.warn.apply(this, arguments);
  }

  error() {
    console.error.apply(this, arguments);
  }
}

module.exports = NafLogger;
},{}],6:[function(require,module,exports){
/* global NAF */
var ReservedDataType = { Update: 'u', UpdateMulti: 'um', Remove: 'r' };

class NetworkConnection {

  constructor(networkEntities) {
    this.entities = networkEntities;
    this.setupDefaultDataSubscriptions();

    this.connectedClients = {};
    this.activeDataChannels = {};
  }

  setNetworkAdapter(adapter) {
    this.adapter = adapter;
  }

  setupDefaultDataSubscriptions() {
    this.dataChannelSubs = {};

    this.dataChannelSubs[ReservedDataType.Update]
        = this.entities.updateEntity.bind(this.entities);

    this.dataChannelSubs[ReservedDataType.UpdateMulti]
        = this.entities.updateEntityMulti.bind(this.entities);

    this.dataChannelSubs[ReservedDataType.Remove]
        = this.entities.removeRemoteEntity.bind(this.entities);
  }

  connect(serverUrl, appName, roomName, enableAudio = false) {
    NAF.app = appName;
    NAF.room = roomName;

    this.adapter.setServerUrl(serverUrl);
    this.adapter.setApp(appName);
    this.adapter.setRoom(roomName);

    var webrtcOptions = {
      audio: enableAudio,
      video: false,
      datachannel: true
    };
    this.adapter.setWebRtcOptions(webrtcOptions);

    this.adapter.setServerConnectListeners(
      this.connectSuccess.bind(this),
      this.connectFailure.bind(this)
    );
    this.adapter.setDataChannelListeners(
      this.dataChannelOpen.bind(this),
      this.dataChannelClosed.bind(this),
      this.receivedData.bind(this)
    );
    this.adapter.setRoomOccupantListener(this.occupantsReceived.bind(this));

    return this.adapter.connect();
  }

  onConnect(callback) {
    this.onConnectCallback = callback;

    if (this.isConnected()) {
      callback();
    } else {
      document.body.addEventListener('connected', callback, false);
    }
  }

  connectSuccess(clientId) {
    NAF.log.write('Networked-Aframe Client ID:', clientId);
    NAF.clientId = clientId;

    var evt = new CustomEvent('connected', {'detail': { clientId: clientId }});
    document.body.dispatchEvent(evt);
  }

  connectFailure(errorCode, message) {
    NAF.log.error(errorCode, "failure to connect");
  }

  occupantsReceived(occupantList) {
    var prevConnectedClients = Object.assign({}, this.connectedClients);
    this.connectedClients = occupantList;
    this.checkForDisconnectingClients(prevConnectedClients, occupantList);
    this.checkForConnectingClients(occupantList);
  }

  checkForDisconnectingClients(oldOccupantList, newOccupantList) {
    for (var id in oldOccupantList) {
      var clientFound = newOccupantList[id];
      if (!clientFound) {
        NAF.log.write('Closing stream to ', id);
        this.adapter.closeStreamConnection(id);
      }
    }
  }

  // Some adapters will handle this internally
  checkForConnectingClients(occupantList) {
    for (var id in occupantList) {
      var startConnection = this.isNewClient(id) && this.adapter.shouldStartConnectionTo(occupantList[id]);
      if (startConnection) {
        NAF.log.write('Opening datachannel to ', id);
        this.adapter.startStreamConnection(id);
      }
    }
  }

  getConnectedClients() {
    return this.connectedClients;
  }

  isConnected() {
    return !!NAF.clientId;
  }

  isMineAndConnected(clientId) {
    return this.isConnected() && NAF.clientId === clientId;
  }

  isNewClient(clientId) {
    return !this.isConnectedTo(clientId);
  }

  isConnectedTo(clientId) {
    return this.adapter.getConnectStatus(clientId) === NAF.adapters.IS_CONNECTED;
  }

  dataChannelOpen(clientId) {
    NAF.log.write('Opened data channel from ' + clientId);
    this.activeDataChannels[clientId] = true;
    this.entities.completeSync(clientId, true);

    var evt = new CustomEvent('clientConnected', {detail: {clientId: clientId}});
    document.body.dispatchEvent(evt);
  }

  dataChannelClosed(clientId) {
    NAF.log.write('Closed data channel from ' + clientId);
    this.activeDataChannels[clientId] = false;
    this.entities.removeEntitiesOfClient(clientId);

    var evt = new CustomEvent('clientDisconnected', {detail: {clientId: clientId}});
    document.body.dispatchEvent(evt);
  }

  hasActiveDataChannel(clientId) {
    return !!(this.activeDataChannels[clientId] && this.activeDataChannels[clientId]);
  }

  broadcastData(dataType, data) {
    this.adapter.broadcastData(dataType, data);
  }

  broadcastDataGuaranteed(dataType, data) {
    this.adapter.broadcastDataGuaranteed(dataType, data);
  }

  sendData(toClientId, dataType, data, guaranteed) {
    if (this.hasActiveDataChannel(toClientId)) {
      if (guaranteed) {
        this.adapter.sendDataGuaranteed(toClientId, dataType, data);
      } else {
        this.adapter.sendData(toClientId, dataType, data);
      }
    } else {
      // console.error("NOT-CONNECTED", "not connected to " + toClient);
    }
  }

  sendDataGuaranteed(toClientId, dataType, data) {
    this.sendData(toClientId, dataType, data, true);
  }

  subscribeToDataChannel(dataType, callback) {
    if (this.isReservedDataType(dataType)) {
      NAF.log.error('NetworkConnection@subscribeToDataChannel: ' + dataType + ' is a reserved dataType. Choose another');
      return;
    }
    this.dataChannelSubs[dataType] = callback;
  }

  unsubscribeToDataChannel(dataType) {
    if (this.isReservedDataType(dataType)) {
      NAF.log.error('NetworkConnection@unsubscribeToDataChannel: ' + dataType + ' is a reserved dataType. Choose another');
      return;
    }
    delete this.dataChannelSubs[dataType];
  }

  isReservedDataType(dataType) {
    return dataType == ReservedDataType.Update
        || dataType == ReservedDataType.Remove;
  }

  receivedData(fromClientId, dataType, data, source) {
    if (this.dataChannelSubs[dataType]) {
      this.dataChannelSubs[dataType](fromClientId, dataType, data, source);
    } else {
      NAF.log.write('NetworkConnection@receivedData: ' + dataType + ' has not been subscribed to yet. Call subscribeToDataChannel()');
    }
  }

  getServerTime() {
    return this.adapter.getServerTime();
  }

  disconnect() {
    this.entities.removeRemoteEntities();
    this.adapter.disconnect();

    NAF.app = '';
    NAF.room = '';
    NAF.clientId = '';
    this.connectedClients = {};
    this.activeDataChannels = {};
    this.adapter = null;

    this.setupDefaultDataSubscriptions();

    document.body.removeEventListener('connected', this.onConnectCallback);
  }
}

module.exports = NetworkConnection;

},{}],7:[function(require,module,exports){
/* global NAF */
var ChildEntityCache = require('./ChildEntityCache');

class NetworkEntities {

  constructor() {
    this.entities = {};
    this.childCache = new ChildEntityCache();
    this.onRemoteEntityCreatedEvent = new Event('remoteEntityCreated');
    this._persistentFirstSyncs = {};
  }

  registerEntity(networkId, entity) {
    this.entities[networkId] = entity;
  }

  createRemoteEntity(entityData) {
    NAF.log.write('Creating remote entity', entityData);

    var networkId = entityData.networkId;
    var el = NAF.schemas.getCachedTemplate(entityData.template);

    el.setAttribute('id', 'naf-' + networkId);

    this.initPosition(el, entityData.components);
    this.initRotation(el, entityData.components);
    this.addNetworkComponent(el, entityData);

    this.registerEntity(networkId, el);

    return el;
  }

  initPosition(entity, componentData) {
    var hasPosition = componentData['position'];
    if (hasPosition) {
      var position = componentData.position;
      entity.setAttribute('position', position);
    }
  }

  initRotation(entity, componentData) {
    var hasRotation = componentData['rotation'];
    if (hasRotation) {
      var rotation = componentData.rotation;
      entity.setAttribute('rotation', rotation);
    }
  }

  addNetworkComponent(entity, entityData) {
    var networkData = {
      template: entityData.template,
      creator: entityData.creator,
      owner: entityData.owner,
      networkId: entityData.networkId,
      persistent: entityData.persistent
    };

    entity.setAttribute('networked', networkData);
    entity.firstUpdateData = entityData;
  }

  updateEntityMulti(client, dataType, entityDatas, source) {
    if (NAF.options.syncSource && source !== NAF.options.syncSource) return;
    for (let i = 0, l = entityDatas.d.length; i < l; i++) {
      this.updateEntity(client, 'u', entityDatas.d[i], source);
    }
  }

  updateEntity(client, dataType, entityData, source) {
    if (NAF.options.syncSource && source !== NAF.options.syncSource) return;
    var networkId = entityData.networkId;

    if (this.hasEntity(networkId)) {
      this.entities[networkId].components.networked.networkUpdate(entityData);
    } else if (entityData.isFirstSync) {
      if (NAF.options.firstSyncSource && source !== NAF.options.firstSyncSource) {
        NAF.log.write('Ignoring first sync from disallowed source', source);
      } else {
        if (entityData.persistent) {
          // If we receive a firstSync for a persistent entity that we don't have yet,
          // we assume the scene will create it at some point, so stash the update for later use.
          this._persistentFirstSyncs[networkId] = entityData;
        } else {
          this.receiveFirstUpdateFromEntity(entityData);
        }
      }
    }
  }

  receiveFirstUpdateFromEntity(entityData) {
    var parent = entityData.parent;
    var networkId = entityData.networkId;

    var parentNotCreatedYet = parent && !this.hasEntity(parent);
    if (parentNotCreatedYet) {
      this.childCache.addChild(parent, entityData);
    } else {
      var remoteEntity = this.createRemoteEntity(entityData);
      this.createAndAppendChildren(networkId, remoteEntity);
      this.addEntityToPage(remoteEntity, parent);
    }
  }

  createAndAppendChildren(parentId, parentEntity) {
    var children = this.childCache.getChildren(parentId);
    for (var i = 0; i < children.length; i++) {
      var childEntityData = children[i];
      var childId = childEntityData.networkId;
      if (this.hasEntity(childId)) {
        NAF.log.warn(
          'Tried to instantiate entity multiple times',
          childId,
          childEntityData,
          'Existing entity:',
          this.getEntity(childId)
        );
        continue;
      }
      var childEntity = this.createRemoteEntity(childEntityData);
      this.createAndAppendChildren(childId, childEntity);
      parentEntity.appendChild(childEntity);
    }
  }

  addEntityToPage(entity, parentId) {
    if (this.hasEntity(parentId)) {
      this.addEntityToParent(entity, parentId);
    } else {
      this.addEntityToSceneRoot(entity);
    }
  }

  addEntityToParent(entity, parentId) {
    var parentEl = document.getElementById('naf-' + parentId);
    parentEl.appendChild(entity);
  }

  addEntityToSceneRoot(el) {
    var scene = document.querySelector('a-scene');
    scene.appendChild(el);
  }

  completeSync(targetClientId, isFirstSync) {
    for (var id in this.entities) {
      if (this.entities[id]) {
        this.entities[id].components.networked.syncAll(targetClientId, isFirstSync);
      }
    }
  }

  removeRemoteEntity(toClient, dataType, data, source) {
    if (NAF.options.syncSource && source !== NAF.options.syncSource) return;
    var id = data.networkId;
    return this.removeEntity(id);
  }

  removeEntitiesOfClient(clientId) {
    var entityList = [];
    for (var id in this.entities) {
      var entityCreator = NAF.utils.getCreator(this.entities[id]);
      if (entityCreator === clientId) {
        let persists;
        const component = this.entities[id].getAttribute('networked');
        if (component && component.persistent) {
          persists = NAF.utils.takeOwnership(this.entities[id]);
        }
        if (!persists) {
          var entity = this.removeEntity(id);
          entityList.push(entity);
        }
      }
    }
    return entityList;
  }

  removeEntity(id) {
    this.forgetPersistentFirstSync(id);

    if (this.hasEntity(id)) {
      var entity = this.entities[id];
      this.forgetEntity(id);
      entity.parentNode.removeChild(entity);
      return entity;
    } else {
      NAF.log.error("Tried to remove entity I don't have.");
      return null;
    }
  }

  forgetEntity(id){
    delete this.entities[id];
    this.forgetPersistentFirstSync(id);
  }

  getPersistentFirstSync(id){
    return this._persistentFirstSyncs[id];
  }

  forgetPersistentFirstSync(id){
    delete this._persistentFirstSyncs[id];
  }

  getEntity(id) {
    if (this.entities[id]) {
      return this.entities[id];
    }
    return null;
  }

  hasEntity(id) {
    return !!this.entities[id];
  }

  removeRemoteEntities() {
    this.childCache = new ChildEntityCache();

    for (var id in this.entities) {
      var owner = this.entities[id].getAttribute('networked').owner;
      if (owner != NAF.clientId) {
        this.removeEntity(id);
      }
    }
  }
}

module.exports = NetworkEntities;

},{"./ChildEntityCache":2}],8:[function(require,module,exports){
/* global NAF */

class Schemas {

  constructor() {
    this.schemaDict = {};
    this.templateCache = {};
  }

  createDefaultSchema(name) {
    return {
      template: name,
      components: [
        'position',
        'rotation',
      ]
    }
  }

  add(schema) {
    if (this.validateSchema(schema)) {
      this.schemaDict[schema.template] = schema;
      var templateEl = document.querySelector(schema.template);
      if (!templateEl) {
        NAF.log.error(`Template el not found for ${schema.template}, make sure NAF.schemas.add is called after <a-scene> is defined.`);
        return;
      }
      if (!this.validateTemplate(schema, templateEl)) {
        return;
      }
      this.templateCache[schema.template] = document.importNode(templateEl.content, true);
    } else {
      NAF.log.error('Schema not valid: ', schema);
      NAF.log.error('See https://github.com/haydenjameslee/networked-aframe#syncing-custom-components');
    }
  }

  getCachedTemplate(template) {
    if (!this.templateIsCached(template)) {
      if (this.templateExistsInScene(template)) {
        this.add(this.createDefaultSchema(template));
      } else {
        NAF.log.error(`Template el for ${template} is not in the scene, add the template to <a-assets> and register with NAF.schemas.add.`);
      }
    }
    return this.templateCache[template].firstElementChild.cloneNode(true);
  }

  templateIsCached(template) {
    return !!this.templateCache[template];
  }

  getComponents(template) {
    var components = ['position', 'rotation'];
    if (this.hasTemplate(template)) {
      components = this.schemaDict[template].components;
    }
    return components;
  }

  hasTemplate(template) {
    return !!this.schemaDict[template];
  }

  templateExistsInScene(templateSelector) {
    var el = document.querySelector(templateSelector);
    return el && this.isTemplateTag(el);
  }

  validateSchema(schema) {
    return !!(schema['template'] && schema['components']);
  }

  validateTemplate(schema, el) {
    if (!this.isTemplateTag(el)) {
      NAF.log.error(`Template for ${schema.template} is not a <template> tag. Instead found: ${el.tagName}`);
      return false;
    } else if (!this.templateHasOneOrZeroChildren(el)) {
      NAF.log.error(`Template for ${schema.template} has more than one child. Templates must have one direct child element, no more. Template found:`, el);
      return false;
    } else {
      return true;
    }
  }

  isTemplateTag(el) {
    return el.tagName.toLowerCase() === 'template';
  }

  templateHasOneOrZeroChildren(el) {
    return el.content.childElementCount < 2;
  }

  remove(template) {
    delete this.schemaDict[template];
  }

  clear() {
    this.schemaDict = {};
  }
}

module.exports = Schemas;

},{}],9:[function(require,module,exports){
const WebrtcAdapter = require("./naf-webrtc-adapter");
const SocketioAdapter = require('./naf-socketio-adapter');

class AdapterFactory {
  constructor() {
    this.adapters = {
      "socketio": SocketioAdapter,
      "webrtc": WebrtcAdapter,
    };

    this.IS_CONNECTED = AdapterFactory.IS_CONNECTED;
    this.CONNECTING = AdapterFactory.CONNECTING;
    this.NOT_CONNECTED = AdapterFactory.NOT_CONNECTED;
  }

  register(adapterName, AdapterClass) {
    this.adapters[adapterName] = AdapterClass;
  }

  make(adapterName) {
    var name = adapterName.toLowerCase();
    if (this.adapters[name]) {
      var AdapterClass = this.adapters[name];
      return new AdapterClass();
    } else if (name === 'easyrtc' || name == 'wseasyrtc') {
      throw new Error(
        "Adapter: " +
          adapterName + 
          " not registered. EasyRTC support was removed in Networked-Aframe 0.7.0." +
          " To use the deprecated EasyRTC adapter see https://github.com/networked-aframe/naf-easyrtc-adapter"
        );
    } else {
      throw new Error(
        "Adapter: " +
          adapterName +
          " not registered. Please use NAF.adapters.register() to register this adapter."
      );
    }
  }
}

AdapterFactory.IS_CONNECTED = "IS_CONNECTED";
AdapterFactory.CONNECTING = "CONNECTING";
AdapterFactory.NOT_CONNECTED = "NOT_CONNECTED";

module.exports = AdapterFactory;

},{"./naf-socketio-adapter":10,"./naf-webrtc-adapter":11}],10:[function(require,module,exports){
/* global NAF, io */

/**
 * SocketIO Adapter (socketio)
 * networked-scene: serverURL needs to be ws://localhost:8080 when running locally
 */
class SocketioAdapter {
  constructor() {
    if (io === undefined)
      console.warn('It looks like socket.io has not been loaded before SocketioAdapter. Please do that.')

    this.app = "default";
    this.room = "default";
    this.occupantListener = null;
    this.myRoomJoinTime = null;
    this.myId = null;

    this.occupants = {}; // id -> joinTimestamp
    this.connectedClients = [];

    this.serverTimeRequests = 0;
    this.timeOffsets = [];
    this.avgTimeOffset = 0;
  }

  setServerUrl(wsUrl) {
    this.wsUrl = wsUrl;
  }

  setApp(appName) {
    this.app = appName;
  }

  setRoom(roomName) {
    this.room = roomName;
  }

  setWebRtcOptions(options) {
    // No WebRTC support
  }

  setServerConnectListeners(successListener, failureListener) {
    this.connectSuccess = successListener;
    this.connectFailure = failureListener;
  }

  setRoomOccupantListener(occupantListener) {
    this.occupantListener = occupantListener;
  }

  setDataChannelListeners(openListener, closedListener, messageListener) {
    this.openListener = openListener;
    this.closedListener = closedListener;
    this.messageListener = messageListener;
  }

  connect() {
    const self = this;

    this.updateTimeOffset()
    .then(() => {
      if (!self.wsUrl || self.wsUrl === "/") {
        if (location.protocol === "https:") {
          self.wsUrl = "wss://" + location.host;
        } else {
          self.wsUrl = "ws://" + location.host;
        }
      }
  
      NAF.log.write("Attempting to connect to socket.io");
      const socket = self.socket = io(self.wsUrl);
  
      socket.on("connect", () => {
        NAF.log.write("User connected", socket.id);
        self.myId = socket.id;
        self.joinRoom();
      });
  
      socket.on("connectSuccess", (data) => {
        const { joinedTime } = data;
  
        self.myRoomJoinTime = joinedTime;
        NAF.log.write("Successfully joined room", self.room, "at server time", joinedTime);

        self.connectSuccess(self.myId);
      });
  
      socket.on("error", err => {
        console.error("Socket connection failure", err);
        self.connectFailure();
      });
  
      socket.on("occupantsChanged", data => {
        const { occupants } = data;
        NAF.log.write('occupants changed', data);
        self.receivedOccupants(occupants);
      });
  
      function receiveData(packet) {
        const from = packet.from;
        const type = packet.type;
        const data = packet.data;
        self.messageListener(from, type, data);
      }
  
      socket.on("send", receiveData);
      socket.on("broadcast", receiveData);
    })
  }

  joinRoom() {
    NAF.log.write("Joining room", this.room);
    this.socket.emit("joinRoom", { room: this.room });
  }

  receivedOccupants(occupants) {
    delete occupants[this.myId];
    this.occupants = occupants;
    this.occupantListener(occupants);
  }

  shouldStartConnectionTo(client) {
    return true;
  }

  startStreamConnection(remoteId) {
    this.connectedClients.push(remoteId);
    this.openListener(remoteId);
  }

  closeStreamConnection(clientId) {
    this.connectedClients = this.connectedClients.filter(c => c != clientId);
    this.closedListener(clientId);
  }

  getConnectStatus(clientId) {
    var connected = this.connectedClients.indexOf(clientId) != -1;

    if (connected) {
      return NAF.adapters.IS_CONNECTED;
    } else {
      return NAF.adapters.NOT_CONNECTED;
    }
  }

  sendData(to, type, data) {
    this.sendDataGuaranteed(to, type, data);
  }

  sendDataGuaranteed(to, type, data) {
    const packet = {
      from: this.myId,
      to,
      type,
      data,
      sending: true,
    };

    if (this.socket) {
      this.socket.emit("send", packet);
    } else {
      NAF.log.warn('SocketIO socket not created yet');
    }
  }

  broadcastData(type, data) {
    this.broadcastDataGuaranteed(type, data);
  }

  broadcastDataGuaranteed(type, data) {
    const packet = {
      from: this.myId,
      type,
      data,
      broadcasting: true
    };

    if (this.socket) {
      this.socket.emit("broadcast", packet);
    } else {
      NAF.log.warn('SocketIO socket not created yet');
    }
  }

  getMediaStream(clientId) {
    // Do not support WebRTC
  }

  updateTimeOffset() {
    const clientSentTime = Date.now() + this.avgTimeOffset;

    return fetch(document.location.href, { method: "HEAD", cache: "no-cache" })
      .then(res => {
        var precision = 1000;
        var serverReceivedTime = new Date(res.headers.get("Date")).getTime() + (precision / 2);
        var clientReceivedTime = Date.now();
        var serverTime = serverReceivedTime + ((clientReceivedTime - clientSentTime) / 2);
        var timeOffset = serverTime - clientReceivedTime;

        this.serverTimeRequests++;

        if (this.serverTimeRequests <= 10) {
          this.timeOffsets.push(timeOffset);
        } else {
          this.timeOffsets[this.serverTimeRequests % 10] = timeOffset;
        }

        this.avgTimeOffset = this.timeOffsets.reduce((acc, offset) => acc += offset, 0) / this.timeOffsets.length;

        if (this.serverTimeRequests > 10) {
          setTimeout(() => this.updateTimeOffset(), 5 * 60 * 1000); // Sync clock every 5 minutes.
        } else {
          this.updateTimeOffset();
        }
      });
  }

  getServerTime() {
    return new Date().getTime() + this.avgTimeOffset;
  }
}

// NAF.adapters.register("socketio", SocketioAdapter);

module.exports = SocketioAdapter;

},{}],11:[function(require,module,exports){
/* global NAF, io */

class WebRtcPeer {
  constructor(localId, remoteId, sendSignalFunc) {
    this.localId = localId;
    this.remoteId = remoteId;
    this.sendSignalFunc = sendSignalFunc;
    this.open = false;
    this.channelLabel = "networked-aframe-channel";

    this.pc = this.createPeerConnection();
    this.channel = null;
  }

  setDatachannelListeners(openListener, closedListener, messageListener, trackListener) {
    this.openListener = openListener;
    this.closedListener = closedListener;
    this.messageListener = messageListener;
    this.trackListener = trackListener;
  }

  offer(options) {
    const self = this;
    // reliable: false - UDP
    this.setupChannel(
      this.pc.createDataChannel(this.channelLabel, { reliable: false })
    );

    // If there are errors with Safari implement this:
    // https://github.com/OpenVidu/openvidu/blob/master/openvidu-browser/src/OpenViduInternal/WebRtcPeer/WebRtcPeer.ts#L154
    
    if (options.sendAudio) {
      options.localAudioStream.getTracks().forEach(
        track => self.pc.addTrack(track, options.localAudioStream));
    }

    this.pc.createOffer(
      sdp => {
        self.handleSessionDescription(sdp);
      },
      error => {
        NAF.log.error("WebRtcPeer.offer: " + error);
      },
      {
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      }
    );
  }

  handleSignal(signal) {
    // ignores signal if it isn't for me
    if (this.localId !== signal.to || this.remoteId !== signal.from) return;

    switch (signal.type) {
      case "offer":
        this.handleOffer(signal);
        break;

      case "answer":
        this.handleAnswer(signal);
        break;

      case "candidate":
        this.handleCandidate(signal);
        break;

      default:
        NAF.log.error(
          "WebRtcPeer.handleSignal: Unknown signal type " + signal.type
        );
        break;
    }
  }

  send(type, data) {
    if (this.channel === null || this.channel.readyState !== "open") {
      return;
    }

    this.channel.send(JSON.stringify({ type: type, data: data }));
  }

  getStatus() {
    if (this.channel === null) return WebRtcPeer.NOT_CONNECTED;

    switch (this.channel.readyState) {
      case "open":
        return WebRtcPeer.IS_CONNECTED;

      case "connecting":
        return WebRtcPeer.CONNECTING;

      case "closing":
      case "closed":
      default:
        return WebRtcPeer.NOT_CONNECTED;
    }
  }

  /*
   * Privates
   */

  createPeerConnection() {
    const self = this;
    const RTCPeerConnection =
      window.RTCPeerConnection ||
      window.webkitRTCPeerConnection ||
      window.mozRTCPeerConnection ||
      window.msRTCPeerConnection;

    if (RTCPeerConnection === undefined) {
      throw new Error(
        "WebRtcPeer.createPeerConnection: This browser does not seem to support WebRTC."
      );
    }

    const pc = new RTCPeerConnection({ iceServers: WebRtcPeer.ICE_SERVERS });

    pc.onicecandidate = function(event) {
      if (event.candidate) {
        self.sendSignalFunc({
          from: self.localId,
          to: self.remoteId,
          type: "candidate",
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          candidate: event.candidate.candidate
        });
      }
    };

    // Note: seems like channel.onclose hander is unreliable on some platforms,
    //       so also tries to detect disconnection here.
    pc.oniceconnectionstatechange = function() {
      if (self.open && pc.iceConnectionState === "disconnected") {
        self.open = false;
        self.closedListener(self.remoteId);
      }
    };

    pc.ontrack = (e) => {
      self.trackListener(self.remoteId, e.streams[0]);
    }

    return pc;
  }

  setupChannel(channel) {
    const self = this;

    this.channel = channel;

    // received data from a remote peer
    this.channel.onmessage = function(event) {
      const data = JSON.parse(event.data);
      self.messageListener(self.remoteId, data.type, data.data);
    };

    // connected with a remote peer
    this.channel.onopen = function(_event) {
      self.open = true;
      self.openListener(self.remoteId);
    };

    // disconnected with a remote peer
    this.channel.onclose = function(_event) {
      if (!self.open) return;
      self.open = false;
      self.closedListener(self.remoteId);
    };

    // error occurred with a remote peer
    this.channel.onerror = function(error) {
      NAF.log.error("WebRtcPeer.channel.onerror: " + error);
    };
  }

  handleOffer(message) {
    const self = this;

    this.pc.ondatachannel = function(event) {
      self.setupChannel(event.channel);
    };

    this.setRemoteDescription(message);

    this.pc.createAnswer(
      function(sdp) {
        self.handleSessionDescription(sdp);
      },
      function(error) {
        NAF.log.error("WebRtcPeer.handleOffer: " + error);
      }
    );
  }

  handleAnswer(message) {
    this.setRemoteDescription(message);
  }

  handleCandidate(message) {
    const RTCIceCandidate =
      window.RTCIceCandidate ||
      window.webkitRTCIceCandidate ||
      window.mozRTCIceCandidate;

    this.pc.addIceCandidate(
      new RTCIceCandidate(message),
      function() {},
      function(error) {
        NAF.log.error("WebRtcPeer.handleCandidate: " + error);
      }
    );
  }

  handleSessionDescription(sdp) {
    this.pc.setLocalDescription(
      sdp,
      function() {},
      function(error) {
        NAF.log.error("WebRtcPeer.handleSessionDescription: " + error);
      }
    );

    this.sendSignalFunc({
      from: this.localId,
      to: this.remoteId,
      type: sdp.type,
      sdp: sdp.sdp
    });
  }

  setRemoteDescription(message) {
    const RTCSessionDescription =
      window.RTCSessionDescription ||
      window.webkitRTCSessionDescription ||
      window.mozRTCSessionDescription ||
      window.msRTCSessionDescription;

    this.pc.setRemoteDescription(
      new RTCSessionDescription(message),
      function() {},
      function(error) {
        NAF.log.error("WebRtcPeer.setRemoteDescription: " + error);
      }
    );
  }

  close() {
    if (this.pc) {
      this.pc.close();
    }
  }
}

WebRtcPeer.IS_CONNECTED = "IS_CONNECTED";
WebRtcPeer.CONNECTING = "CONNECTING";
WebRtcPeer.NOT_CONNECTED = "NOT_CONNECTED";

WebRtcPeer.ICE_SERVERS = [
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" }
];

/**
 * Native WebRTC Adapter (native-webrtc)
 * For use with uws-server.js
 * networked-scene: serverURL needs to be ws://localhost:8080 when running locally
 */
class WebrtcAdapter {
  constructor() {
    if (io === undefined)
      console.warn('It looks like socket.io has not been loaded before WebrtcAdapter. Please do that.')

    this.app = "default";
    this.room = "default";
    this.occupantListener = null;
    this.myRoomJoinTime = null;
    this.myId = null;

    this.peers = {}; // id -> WebRtcPeer
    this.occupants = {}; // id -> joinTimestamp

    this.audioStreams = {};
    this.pendingAudioRequest = {};

    this.serverTimeRequests = 0;
    this.timeOffsets = [];
    this.avgTimeOffset = 0;
  }

  setServerUrl(wsUrl) {
    this.wsUrl = wsUrl;
  }

  setApp(appName) {
    this.app = appName;
  }

  setRoom(roomName) {
    this.room = roomName;
  }

  setWebRtcOptions(options) {
    if (options.datachannel === false) {
      NAF.log.error(
        "WebrtcAdapter.setWebRtcOptions: datachannel must be true."
      );
    }
    if (options.audio === true) {
      this.sendAudio = true;
    }
    if (options.video === true) {
      NAF.log.warn("WebrtcAdapter does not support video yet.");
    }
  }

  setServerConnectListeners(successListener, failureListener) {
    this.connectSuccess = successListener;
    this.connectFailure = failureListener;
  }

  setRoomOccupantListener(occupantListener) {
    this.occupantListener = occupantListener;
  }

  setDataChannelListeners(openListener, closedListener, messageListener) {
    this.openListener = openListener;
    this.closedListener = closedListener;
    this.messageListener = messageListener;
  }

  connect() {
    const self = this;

    this.updateTimeOffset()
    .then(() => {
      if (!self.wsUrl || self.wsUrl === "/") {
        if (location.protocol === "https:") {
          self.wsUrl = "wss://" + location.host;
        } else {
          self.wsUrl = "ws://" + location.host;
        }
      }
  
      NAF.log.write("Attempting to connect to socket.io");
      const socket = self.socket = io(self.wsUrl);
  
      socket.on("connect", () => {
        NAF.log.write("User connected", socket.id);
        self.myId = socket.id;
        self.joinRoom();
      });
  
      socket.on("connectSuccess", (data) => {
        const { joinedTime } = data;
  
        self.myRoomJoinTime = joinedTime;
        NAF.log.write("Successfully joined room", self.room, "at server time", joinedTime);
  
        if (self.sendAudio) {
          const mediaConstraints = {
            audio: true,
            video: false
          };
          navigator.mediaDevices.getUserMedia(mediaConstraints)
          .then(localStream => {
            self.storeAudioStream(self.myId, localStream);
            self.connectSuccess(self.myId);
            localStream.getTracks().forEach(
              track => {
                Object.keys(self.peers).forEach(peerId => { 
                self.peers[peerId].pc.addTrack(track, localStream) 
              })
            })
          })
          .catch(e => {
            NAF.log.error(e);
            console.error("Microphone is disabled due to lack of permissions");
            self.sendAudio = false;
            self.connectSuccess(self.myId);
          });
        } else {
          self.connectSuccess(self.myId);
        }
      });
  
      socket.on("error", err => {
        console.error("Socket connection failure", err);
        self.connectFailure();
      });
  
      socket.on("occupantsChanged", data => {
        const { occupants } = data;
        NAF.log.write('occupants changed', data);
        self.receivedOccupants(occupants);
      });
  
      function receiveData(packet) {
        const from = packet.from;
        const type = packet.type;
        const data = packet.data;
        if (type === 'ice-candidate') {
          self.peers[from].handleSignal(data);
          return;
        }
        self.messageListener(from, type, data);
      }
  
      socket.on("send", receiveData);
      socket.on("broadcast", receiveData);
    })
  }

  joinRoom() {
    NAF.log.write("Joining room", this.room);
    this.socket.emit("joinRoom", { room: this.room });
  }

  receivedOccupants(occupants) {
    delete occupants[this.myId];

    this.occupants = occupants;

    const self = this;
    const localId = this.myId;

    for (let key in occupants) {
      const remoteId = key;
      if (this.peers[remoteId]) continue;

      const peer = new WebRtcPeer(
        localId,
        remoteId,
        (data) => {
          self.socket.emit('send',{
            from: localId,
            to: remoteId,
            type: 'ice-candidate',
            data,
            sending: true,
          });
        }
      );
      peer.setDatachannelListeners(
        self.openListener,
        self.closedListener,
        self.messageListener,
        self.trackListener.bind(self)
      );

      self.peers[remoteId] = peer;
    }

    this.occupantListener(occupants);
  }

  shouldStartConnectionTo(client) {
    return (this.myRoomJoinTime || 0) <= (client || 0);
  }

  startStreamConnection(remoteId) {
    NAF.log.write('starting offer process');

    if (this.sendAudio) {
      this.getMediaStream(this.myId)
      .then(stream => {
        const options = {
          sendAudio: true,
          localAudioStream: stream,
        };
        this.peers[remoteId].offer(options);
      });
    } else {
      this.peers[remoteId].offer({});
    }
  }

  closeStreamConnection(clientId) {
    NAF.log.write('closeStreamConnection', clientId, this.peers);
    this.peers[clientId].close();
    delete this.peers[clientId];
    delete this.occupants[clientId];
    this.closedListener(clientId);
  }

  getConnectStatus(clientId) {
    const peer = this.peers[clientId];

    if (peer === undefined) return NAF.adapters.NOT_CONNECTED;

    switch (peer.getStatus()) {
      case WebRtcPeer.IS_CONNECTED:
        return NAF.adapters.IS_CONNECTED;

      case WebRtcPeer.CONNECTING:
        return NAF.adapters.CONNECTING;

      case WebRtcPeer.NOT_CONNECTED:
      default:
        return NAF.adapters.NOT_CONNECTED;
    }
  }

  sendData(to, type, data) {
    this.peers[to].send(type, data);
  }

  sendDataGuaranteed(to, type, data) {
    const packet = {
      from: this.myId,
      to,
      type,
      data,
      sending: true,
    };

    this.socket.emit("send", packet);
  }

  broadcastData(type, data) {
    for (let clientId in this.peers) {
      this.sendData(clientId, type, data);
    }
  }

  broadcastDataGuaranteed(type, data) {
    const packet = {
      from: this.myId,
      type,
      data,
      broadcasting: true
    };
    this.socket.emit("broadcast", packet);
  }

  storeAudioStream(clientId, stream) {
    this.audioStreams[clientId] = stream;
    if (this.pendingAudioRequest[clientId]) {
      NAF.log.write("Received pending audio for " + clientId);
      this.pendingAudioRequest[clientId](stream);
      delete this.pendingAudioRequest[clientId](stream);
    }
  }

  trackListener(clientId, stream) {
    this.storeAudioStream(clientId, stream);
  }

  getMediaStream(clientId) {
    const self = this;
    if (this.audioStreams[clientId]) {
      NAF.log.write("Already had audio for " + clientId);
      return Promise.resolve(this.audioStreams[clientId]);
    } else {
      NAF.log.write("Waiting on audio for " + clientId);
      return new Promise(resolve => {
        self.pendingAudioRequest[clientId] = resolve;
      });
    }
  }

  updateTimeOffset() {
    const clientSentTime = Date.now() + this.avgTimeOffset;

    return fetch(document.location.href, { method: "HEAD", cache: "no-cache" })
      .then(res => {
        const precision = 1000;
        const serverReceivedTime = new Date(res.headers.get("Date")).getTime() + (precision / 2);
        const clientReceivedTime = Date.now();
        const serverTime = serverReceivedTime + ((clientReceivedTime - clientSentTime) / 2);
        const timeOffset = serverTime - clientReceivedTime;

        this.serverTimeRequests++;

        if (this.serverTimeRequests <= 10) {
          this.timeOffsets.push(timeOffset);
        } else {
          this.timeOffsets[this.serverTimeRequests % 10] = timeOffset;
        }

        this.avgTimeOffset = this.timeOffsets.reduce((acc, offset) => acc += offset, 0) / this.timeOffsets.length;

        if (this.serverTimeRequests > 10) {
          setTimeout(() => this.updateTimeOffset(), 5 * 60 * 1000); // Sync clock every 5 minutes.
        } else {
          this.updateTimeOffset();
        }
      });
  }

  getServerTime() {
    return new Date().getTime() + this.avgTimeOffset;
  }
}

// NAF.adapters.register("native-webrtc", WebrtcAdapter);

module.exports = WebrtcAdapter;

},{}],12:[function(require,module,exports){
/* global AFRAME, NAF, THREE */
var naf = require('../NafIndex');

AFRAME.registerComponent('networked-audio-source', {
  schema: {
    positional: { default: true },
    distanceModel: {
      default: "inverse",
      oneOf: ["linear", "inverse", "exponential"]
    },
    maxDistance: { default: 10000 },
    refDistance: { default: 1 },
    rolloffFactor: { default: 1 }
  },

  init: function () {
    this.listener = null;
    this.stream = null;

    this._setMediaStream = this._setMediaStream.bind(this);

    NAF.utils.getNetworkedEntity(this.el).then((networkedEl) => {
      const ownerId = networkedEl.components.networked.data.owner;

      if (ownerId) {
        NAF.connection.adapter.getMediaStream(ownerId)
          .then(this._setMediaStream)
          .catch((e) => naf.log.error(`Error getting media stream for ${ownerId}`, e));
      } else {
        // Correctly configured local entity, perhaps do something here for enabling debug audio loopback
      }
    });
  },

  update() {
    this._setPannerProperties();
  },

  _setMediaStream(newStream) {
    if(!this.sound) {
      this.setupSound();
    }

    if(newStream != this.stream) {
      if(this.stream) {
        this.sound.disconnect();
      }
      if(newStream) {
        // Chrome seems to require a MediaStream be attached to an AudioElement before AudioNodes work correctly
        // We don't want to do this in other browsers, particularly in Safari, which actually plays the audio despite
        // setting the volume to 0.
        if (/chrome/i.test(navigator.userAgent)) {
          this.audioEl = new Audio();
          this.audioEl.setAttribute("autoplay", "autoplay");
          this.audioEl.setAttribute("playsinline", "playsinline");
          this.audioEl.srcObject = newStream;
          this.audioEl.volume = 0; // we don't actually want to hear audio from this element
        }

        const soundSource = this.sound.context.createMediaStreamSource(newStream); 
        this.sound.setNodeSource(soundSource);
        this.el.emit('sound-source-set', { soundSource });
      }
      this.stream = newStream;
    }
  },

  _setPannerProperties() {
    if (this.sound && this.data.positional) {
      this.sound.setDistanceModel(this.data.distanceModel);
      this.sound.setMaxDistance(this.data.maxDistance);
      this.sound.setRefDistance(this.data.refDistance);
      this.sound.setRolloffFactor(this.data.rolloffFactor);
    }
  },

  remove: function() {
    if (!this.sound) return;

    this.el.removeObject3D(this.attrName);
    if (this.stream) {
      this.sound.disconnect();
    }
  },

  setupSound: function() {
    var el = this.el;
    var sceneEl = el.sceneEl;

    if (this.sound) {
      el.removeObject3D(this.attrName);
    }

    if (!sceneEl.audioListener) {
      sceneEl.audioListener = new THREE.AudioListener();
      sceneEl.camera && sceneEl.camera.add(sceneEl.audioListener);
      sceneEl.addEventListener('camera-set-active', function(evt) {
        evt.detail.cameraEl.getObject3D('camera').add(sceneEl.audioListener);
      });
    }
    this.listener = sceneEl.audioListener;

    this.sound = this.data.positional
      ? new THREE.PositionalAudio(this.listener)
      : new THREE.Audio(this.listener);
    el.setObject3D(this.attrName, this.sound);
    this._setPannerProperties();
  }
});

},{"../NafIndex":4}],13:[function(require,module,exports){
/* global AFRAME, NAF */

AFRAME.registerComponent('networked-scene', {
  schema: {
    serverURL: {default: '/'},
    app: {default: 'default'},
    room: {default: 'default'},
    connectOnLoad: {default: true},
    onConnect: {default: 'onConnect'},
    adapter: {default: 'socketio'}, // See https://github.com/networked-aframe/networked-aframe#adapters for list of adapters
    audio: {default: false}, // Only if adapter supports audio
    debug: {default: false},
  },

  init: function() {
    var el = this.el;
    this.connect = this.connect.bind(this);
    el.addEventListener('connect', this.connect);
    if (this.data.connectOnLoad) {
      el.emit('connect', null, false);
    }
  },

  /**
   * Connect to signalling server and begin connecting to other clients
   */
  connect: function () {
    NAF.log.setDebug(this.data.debug);
    NAF.log.write('Networked-Aframe Connecting...');

    this.checkDeprecatedProperties();
    this.setupNetworkAdapter();

    if (this.hasOnConnectFunction()) {
      this.callOnConnect();
    }
    return NAF.connection.connect(this.data.serverURL, this.data.app, this.data.room, this.data.audio);
  },

  checkDeprecatedProperties: function() {
    // No current
  },

  setupNetworkAdapter: function() {
    var adapterName = this.data.adapter;
    var adapter = NAF.adapters.make(adapterName);
    NAF.connection.setNetworkAdapter(adapter);
    this.el.emit('adapter-ready', adapter, false);
  },

  hasOnConnectFunction: function() {
    return this.data.onConnect != '' && window[this.data.onConnect];
  },

  callOnConnect: function() {
    NAF.connection.onConnect(window[this.data.onConnect]);
  },

  remove: function() {
    NAF.log.write('networked-scene disconnected');
    this.el.removeEventListener('connect', this.connect);
    NAF.connection.disconnect();
  }
});

},{}],14:[function(require,module,exports){
/* global AFRAME, NAF, THREE */
var deepEqual = require('../DeepEquals');
var InterpolationBuffer = require('buffered-interpolation');
var DEG2RAD = THREE.Math.DEG2RAD;
var OBJECT3D_COMPONENTS = ['position', 'rotation', 'scale'];

function defaultRequiresUpdate() {
  let cachedData = null;

  return (newData) => {
    if (cachedData === null || !deepEqual(cachedData, newData)) {
      cachedData = AFRAME.utils.clone(newData);
      return true;
    }

    return false;
  };
}

AFRAME.registerSystem("networked", {
  init() {
    this.components = [];
    this.nextSyncTime = 0;
  },

  register(component) {
    this.components.push(component);
  },

  deregister(component) {
    const idx = this.components.indexOf(component);

    if (idx > -1) {
      this.components.splice(idx, 1);
    }
  },

  tick: (function() {

    return function() {
      if (!NAF.connection.adapter) return;
      if (this.el.clock.elapsedTime < this.nextSyncTime) return;

      const data = { d: [] };

      for (let i = 0, l = this.components.length; i < l; i++) {
        const c = this.components[i];
        if (!c.isMine()) continue;
        if (!c.el.parentElement) {
          NAF.log.error("entity registered with system despite being removed");
          //TODO: Find out why tick is still being called
          return;
        }

        const syncData = this.components[i].syncDirty();
        if (!syncData) continue;

        data.d.push(syncData);
      }

      if (data.d.length > 0) {
        NAF.connection.broadcastData('um', data);
      }

      this.updateNextSyncTime();
    };
  })(),

  updateNextSyncTime() {
    this.nextSyncTime = this.el.clock.elapsedTime + 1 / NAF.options.updateRate;
  }
});

AFRAME.registerComponent('networked', {
  schema: {
    template: {default: ''},
    attachTemplateToLocal: { default: true },
    persistent: { default: false },

    networkId: {default: ''},
    owner: {default: ''},
    creator: {default: ''}
  },

  init: function() {
    this.OWNERSHIP_GAINED = 'ownership-gained';
    this.OWNERSHIP_CHANGED = 'ownership-changed';
    this.OWNERSHIP_LOST = 'ownership-lost';

    this.onOwnershipGainedEvent = {
      el: this.el
    };
    this.onOwnershipChangedEvent = {
      el: this.el
    };
    this.onOwnershipLostEvent = {
      el: this.el
    };

    this.conversionEuler = new THREE.Euler();
    this.conversionEuler.order = "YXZ";
    this.bufferInfos = [];
    this.bufferPosition = new THREE.Vector3();
    this.bufferQuaternion = new THREE.Quaternion();
    this.bufferScale = new THREE.Vector3();

    var wasCreatedByNetwork = this.wasCreatedByNetwork();

    this.onConnected = this.onConnected.bind(this);

    this.syncData = {};
    this.componentSchemas =  NAF.schemas.getComponents(this.data.template);
    this.cachedElements = new Array(this.componentSchemas.length);
    this.networkUpdatePredicates = this.componentSchemas.map(x => (x.requiresNetworkUpdate && x.requiresNetworkUpdate()) || defaultRequiresUpdate());

    // Fill cachedElements array with null elements
    this.invalidateCachedElements();

    this.initNetworkParent();

    if (this.data.networkId === '') {
      this.el.setAttribute(this.name, {networkId: NAF.utils.createNetworkId()});
    }

    if (wasCreatedByNetwork) {
      this.firstUpdate();
    } else {
      if (this.data.attachTemplateToLocal) {
        this.attachTemplateToLocal();
      }

      this.registerEntity(this.data.networkId);
    }

    this.lastOwnerTime = -1;

    if (NAF.clientId) {
      this.onConnected();
    } else {
      document.body.addEventListener('connected', this.onConnected, false);
    }

    document.body.dispatchEvent(this.entityCreatedEvent());
    this.el.dispatchEvent(new CustomEvent('instantiated', {detail: {el: this.el}}));
    this.el.sceneEl.systems.networked.register(this);
  },

  attachTemplateToLocal: function() {
    const template = NAF.schemas.getCachedTemplate(this.data.template);
    const elAttrs = template.attributes;

    // Merge root element attributes with this entity
    for (let attrIdx = 0; attrIdx < elAttrs.length; attrIdx++) {
      this.el.setAttribute(elAttrs[attrIdx].name, elAttrs[attrIdx].value);
    }

    // Append all child elements
    while (template.firstElementChild) {
      this.el.appendChild(template.firstElementChild);
    }
  },

  takeOwnership: function() {
    const owner = this.data.owner;
    const lastOwnerTime = this.lastOwnerTime;
    const now = NAF.connection.getServerTime();
    if (owner && !this.isMine() && lastOwnerTime < now) {
      this.lastOwnerTime = now;
      this.removeLerp();
      this.el.setAttribute('networked', { owner: NAF.clientId });
      this.syncAll();

      this.onOwnershipGainedEvent.oldOwner = owner;
      this.el.emit(this.OWNERSHIP_GAINED, this.onOwnershipGainedEvent);

      this.onOwnershipChangedEvent.oldOwner = owner;
      this.onOwnershipChangedEvent.newOwner = NAF.clientId;
      this.el.emit(this.OWNERSHIP_CHANGED, this.onOwnershipChangedEvent);

      return true;
    }
    return false;
  },

  wasCreatedByNetwork: function() {
    return !!this.el.firstUpdateData;
  },

  initNetworkParent: function() {
    var parentEl = this.el.parentElement;
    if (parentEl['components'] && parentEl.components['networked']) {
      this.parent = parentEl;
    } else {
      this.parent = null;
    }
  },

  registerEntity: function(networkId) {
    NAF.entities.registerEntity(networkId, this.el);
  },

  applyPersistentFirstSync: function() {
    const { networkId } = this.data;
    const persistentFirstSync = NAF.entities.getPersistentFirstSync(networkId);
    if (persistentFirstSync) {
      this.networkUpdate(persistentFirstSync);
      NAF.entities.forgetPersistentFirstSync(networkId);
    }
  },

  firstUpdate: function() {
    var entityData = this.el.firstUpdateData;
    this.networkUpdate(entityData);
  },

  onConnected: function() {
    if (this.data.owner === '') {
      this.lastOwnerTime = NAF.connection.getServerTime();
      this.el.setAttribute(this.name, { owner: NAF.clientId, creator: NAF.clientId });
      setTimeout(() => {
        //a-primitives attach their components on the next frame; wait for components to be attached before calling syncAll
        if (!this.el.parentNode){
          NAF.log.warn("Networked element was removed before ever getting the chance to syncAll");
          return;
        }
        this.syncAll(undefined, true);
      }, 0);
    }

    document.body.removeEventListener('connected', this.onConnected, false);
  },

  isMine: function() {
    return this.data.owner === NAF.clientId;
  },

  createdByMe: function() {
    return this.data.creator === NAF.clientId;
  },

  tick: function(time, dt) {
    if (!this.isMine() && NAF.options.useLerp) {
      for (var i = 0; i < this.bufferInfos.length; i++) {
        var bufferInfo = this.bufferInfos[i];
        var buffer = bufferInfo.buffer;
        var object3D = bufferInfo.object3D;
        var componentNames = bufferInfo.componentNames;
        buffer.update(dt);
        if (componentNames.includes('position')) {
          object3D.position.copy(buffer.getPosition());
        }
        if (componentNames.includes('rotation')) {
          object3D.quaternion.copy(buffer.getQuaternion());
        }
        if (componentNames.includes('scale')) {
          object3D.scale.copy(buffer.getScale());
        }
      }
    }
  },

  /* Sending updates */

  syncAll: function(targetClientId, isFirstSync) {
    if (!this.canSync()) {
      return;
    }

    var components = this.gatherComponentsData(true);

    var syncData = this.createSyncData(components, isFirstSync);

    if (targetClientId) {
      NAF.connection.sendDataGuaranteed(targetClientId, 'u', syncData);
    } else {
      NAF.connection.broadcastDataGuaranteed('u', syncData);
    }
  },

  syncDirty: function() {
    if (!this.canSync()) {
      return;
    }

    var components = this.gatherComponentsData(false);

    if (components === null) {
      return;
    }

    return this.createSyncData(components);
  },

  getCachedElement(componentSchemaIndex) {
    var cachedElement = this.cachedElements[componentSchemaIndex];

    if (cachedElement) {
      return cachedElement;
    }

    var componentSchema = this.componentSchemas[componentSchemaIndex];

    if (componentSchema.selector) {
      return this.cachedElements[componentSchemaIndex] = this.el.querySelector(componentSchema.selector);
    } else {
      return this.cachedElements[componentSchemaIndex] = this.el;
    }
  },

  invalidateCachedElements() {
    for (var i = 0; i < this.cachedElements.length; i++) {
      this.cachedElements[i] = null;
    }
  },

  gatherComponentsData: function(fullSync) {
    var componentsData = null;

    for (var i = 0; i < this.componentSchemas.length; i++) {
      var componentSchema = this.componentSchemas[i];
      var componentElement = this.getCachedElement(i);

      if (!componentElement) {
        if (fullSync) {
          componentsData = componentsData || {};
          componentsData[i] = null;
        }
        continue;
      }

      var componentName = componentSchema.component ? componentSchema.component : componentSchema;
      var componentData = componentElement.getAttribute(componentName);

      if (componentData === null) {
        if (fullSync) {
          componentsData = componentsData || {};
          componentsData[i] = null;
        }
        continue;
      }

      var syncedComponentData = componentSchema.property ? componentData[componentSchema.property] : componentData;

      // Use networkUpdatePredicate to check if the component needs to be updated.
      // Call networkUpdatePredicate first so that it can update any cached values in the event of a fullSync.
      if (this.networkUpdatePredicates[i](syncedComponentData) || fullSync) {
        componentsData = componentsData || {};
        componentsData[i] = syncedComponentData;
      }
    }

    return componentsData;
  },

  createSyncData: function(components, isFirstSync) {
    var { syncData, data } = this;
    syncData.networkId = data.networkId;
    syncData.owner = data.owner;
    syncData.creator = data.creator;
    syncData.lastOwnerTime = this.lastOwnerTime;
    syncData.template = data.template;
    syncData.persistent = data.persistent;
    syncData.parent = this.getParentId();
    syncData.components = components;
    syncData.isFirstSync = !!isFirstSync;
    return syncData;
  },

  canSync: function() {
    // This client will send a sync if:
    //
    // - The client is the owner
    // - The client is the creator, and the owner is not in the room.
    //
    // The reason for the latter case is so the object will still be
    // properly instantiated if the owner leaves. (Since the object lifetime
    // is tied to the creator.)
    if (this.data.owner && this.isMine()) return true;
    if (!this.createdByMe()) return false;

    const clients = NAF.connection.getConnectedClients();

    for (let clientId in clients) {
      if (clientId === this.data.owner) return false;
    }

    return true;
  },

  getParentId: function() {
    this.initNetworkParent(); // TODO fix calling this each network tick
    if (!this.parent) {
      return null;
    }
    var netComp = this.parent.getAttribute('networked');
    return netComp.networkId;
  },

  /* Receiving updates */

  networkUpdate: function(entityData) {
    // Avoid updating components if the entity data received did not come from the current owner.
    if (entityData.lastOwnerTime < this.lastOwnerTime ||
          (this.lastOwnerTime === entityData.lastOwnerTime && this.data.owner > entityData.owner)) {
      return;
    }

    // Hack to solve this bug: https://github.com/networked-aframe/networked-aframe/issues/200
    if (this.data === undefined) {
      return;
    }

    if (this.data.owner !== entityData.owner) {
      var wasMine = this.isMine();
      this.lastOwnerTime = entityData.lastOwnerTime;

      const oldOwner = this.data.owner;
      const newOwner = entityData.owner;

      this.el.setAttribute('networked', { owner: entityData.owner });

      if (wasMine) {
        this.onOwnershipLostEvent.newOwner = newOwner;
        this.el.emit(this.OWNERSHIP_LOST, this.onOwnershipLostEvent);
      }
      this.onOwnershipChangedEvent.oldOwner = oldOwner;
      this.onOwnershipChangedEvent.newOwner = newOwner;
      this.el.emit(this.OWNERSHIP_CHANGED, this.onOwnershipChangedEvent);
    }
    if (this.data.persistent !== entityData.persistent) {
      this.el.setAttribute('networked', { persistent: entityData.persistent });
    }
    this.updateNetworkedComponents(entityData.components);
  },

  updateNetworkedComponents: function(components) {
    for (var componentIndex = 0, l = this.componentSchemas.length; componentIndex < l; componentIndex++) {
      var componentData = components[componentIndex];
      var componentSchema = this.componentSchemas[componentIndex];
      var componentElement = this.getCachedElement(componentIndex);

      if (componentElement === null || componentData === null || componentData === undefined ) {
        continue;
      }

      if (componentSchema.component) {
        if (componentSchema.property) {
          this.updateNetworkedComponent(componentElement, componentSchema.component, componentSchema.property, componentData);
        } else {
          this.updateNetworkedComponent(componentElement, componentSchema.component, componentData);
        }
      } else {
        this.updateNetworkedComponent(componentElement, componentSchema, componentData);
      }
    }
  },

  updateNetworkedComponent: function (el, componentName, data, value) {
    if(!NAF.options.useLerp || !OBJECT3D_COMPONENTS.includes(componentName)) {
      if (value === undefined) {
        el.setAttribute(componentName, data);
      } else {
        el.setAttribute(componentName, data, value);
      }
      return;
    }

    let bufferInfo;

    for (let i = 0, l = this.bufferInfos.length; i < l; i++) {
      const info = this.bufferInfos[i];

      if (info.object3D === el.object3D) {
        bufferInfo = info;
        break;
      }
    }

    if (!bufferInfo) {
      bufferInfo = { buffer: new InterpolationBuffer(InterpolationBuffer.MODE_LERP, 0.1),
                     object3D: el.object3D,
                     componentNames: [componentName] };
      this.bufferInfos.push(bufferInfo);
    } else {
      var componentNames = bufferInfo.componentNames;
      if (!componentNames.includes(componentName)) {
        componentNames.push(componentName);
      }
    }
    var buffer = bufferInfo.buffer;

    switch(componentName) {
      case 'position':
        buffer.setPosition(this.bufferPosition.set(data.x, data.y, data.z));
        return;
      case 'rotation':
        this.conversionEuler.set(DEG2RAD * data.x, DEG2RAD * data.y, DEG2RAD * data.z);
        buffer.setQuaternion(this.bufferQuaternion.setFromEuler(this.conversionEuler));
        return;
      case 'scale':
        buffer.setScale(this.bufferScale.set(data.x, data.y, data.z));
        return;
    }
    NAF.log.error('Could not set value in interpolation buffer.', el, componentName, data, bufferInfo);
  },

  removeLerp: function() {
    this.bufferInfos = [];
  },

  remove: function () {
    if (this.isMine() && NAF.connection.isConnected()) {
      var syncData = { networkId: this.data.networkId };
      if (NAF.entities.hasEntity(this.data.networkId)) {
        NAF.connection.broadcastDataGuaranteed('r', syncData);
      } else {
        NAF.log.error("Removing networked entity that is not in entities array.");
      }
    }
    NAF.entities.forgetEntity(this.data.networkId);
    document.body.dispatchEvent(this.entityRemovedEvent(this.data.networkId));
    this.el.sceneEl.systems.networked.deregister(this);
  },

  entityCreatedEvent() {
    return new CustomEvent('entityCreated', {detail: {el: this.el}});
  },

  entityRemovedEvent(networkId) {
    return new CustomEvent('entityRemoved', {detail: {networkId: networkId}});
  }
});

},{"../DeepEquals":3,"buffered-interpolation":1}],15:[function(require,module,exports){
// Global vars and functions
require('./NafIndex.js');

// Network components
require('./components/networked-scene');
require('./components/networked');
require('./components/networked-audio-source');

},{"./NafIndex.js":4,"./components/networked":14,"./components/networked-audio-source":12,"./components/networked-scene":13}],16:[function(require,module,exports){
var options = {
  debug: false,
  updateRate: 15, // How often network components call `sync`
  useLerp: true, // lerp position, rotation, and scale components on networked entities.
  firstSyncSource: null, // If specified, only allow first syncs from this source.
  syncSource: null, // If specified, only allow syncs from this source.
};
module.exports = options;

},{}],17:[function(require,module,exports){
/* global NAF */

module.exports.whenEntityLoaded = function(entity, callback) {
  if (entity.hasLoaded) { callback(); }
  entity.addEventListener('loaded', function () {
    callback();
  });
}

module.exports.createHtmlNodeFromString = function(str) {
  var div = document.createElement('div');
  div.innerHTML = str;
  var child = div.firstChild;
  return child;
}

module.exports.getCreator = function(el) {
  var components = el.components;
  if (components['networked']) {
    return components['networked'].data.creator;
  }
  return null;
}

module.exports.getNetworkOwner = function(el) {
  var components = el.components;
  if (components['networked']) {
    return components['networked'].data.owner;
  }
  return null;
}

module.exports.getNetworkId = function(el) {
  var components = el.components;
  if (components['networked']) {
    return components['networked'].data.networkId;
  }
  return null;
}

module.exports.now = function() {
  return Date.now();
};

module.exports.createNetworkId = function() {
  return Math.random().toString(36).substring(2, 9);
};

/**
 * Find the closest ancestor (including the passed in entity) that has a `networked` component
 * @param {ANode} entity - Entity to begin the search on
 * @returns {Promise<ANode>} An promise that resolves to an entity with a `networked` component
 */
function getNetworkedEntity(entity) {
  return new Promise((resolve, reject) => {
    let curEntity = entity;

    while(curEntity && curEntity.components && !curEntity.components.networked) {
      curEntity = curEntity.parentNode;
    }

    if (!curEntity || !curEntity.components || !curEntity.components.networked) {
      return reject("Entity does not have and is not a child of an entity with the [networked] component ");
    }

    if (curEntity.hasLoaded) {
      resolve(curEntity);
    } else {
      curEntity.addEventListener("instantiated", () => {
        resolve(curEntity);
      }, { once: true });
    }
  });
}

module.exports.getNetworkedEntity = getNetworkedEntity;

module.exports.takeOwnership = function(entity) {
  let curEntity = entity;

  while(curEntity && curEntity.components && !curEntity.components.networked) {
    curEntity = curEntity.parentNode;
  }

  if (!curEntity || !curEntity.components || !curEntity.components.networked) {
    throw new Error("Entity does not have and is not a child of an entity with the [networked] component ");
  }

  return curEntity.components.networked.takeOwnership();
};

module.exports.isMine = function(entity) {
  let curEntity = entity;

  while(curEntity && curEntity.components && !curEntity.components.networked) {
    curEntity = curEntity.parentNode;
  }

  if (!curEntity || !curEntity.components || !curEntity.components.networked) {
    throw new Error("Entity does not have and is not a child of an entity with the [networked] component ");
  }

  return curEntity.components.networked.data.owner === NAF.clientId;
};

module.exports.almostEqualVec3 = function(u, v, epsilon) {
  return Math.abs(u.x-v.x)<epsilon && Math.abs(u.y-v.y)<epsilon && Math.abs(u.z-v.z)<epsilon;
};

},{}]},{},[15]);
