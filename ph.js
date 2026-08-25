// ph.js — CardOS lite capture. No SDK. Funnel only.
(function (w) {
  var KEY = w.CARDOS_PH_KEY || '';
  var HOST = (w.CARDOS_PH_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');
  var PLATFORM = w.CARDOS_PH_PLATFORM || 'web';
  var ID_KEY = 'cardos_ph_id';
  var OPT = 'cardos_analytics_optout';
  var ONCE = 'ph_once:';
  function dead() {
    var h = w.location.hostname;
    if (!KEY) return true;
    if (h === 'localhost' || h === '127.0.0.1' || /\.workers\.dev$/.test(h)) return true;
    if (w.navigator && w.navigator.globalPrivacyControl) return true;
    try { if (w.localStorage.getItem(OPT) === 'true') return true; } catch (e) {}
    return false;
  }
  function uuid() {
    if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function getId() {
    try {
      var id = w.localStorage.getItem(ID_KEY);
      if (!id) { id = uuid(); w.localStorage.setItem(ID_KEY, id); }
      return id;
    } catch (e) { return uuid(); }
  }
  function send(event, props) {
    if (dead()) return;
    props = props || {};
    var distinct = props.distinct_id || getId();
    delete props.distinct_id;
    var identified = false;
    try { identified = w.localStorage.getItem(ID_KEY + ':id') === '1'; } catch (e) {}
    var body = {
      api_key: KEY,
      event: event,
      distinct_id: distinct,
      properties: Object.assign({
        platform: PLATFORM,
        $lib: 'cardos-ph-lite',
        $current_url: w.location.href
      }, props)
    };
    if (!identified && event !== '$identify' && event !== '$create_alias') {
      body.properties.$process_person_profile = false;
    }
    var url = HOST + '/i/v0/e/';
    var json = JSON.stringify(body);
    var blob = new Blob([json], { type: 'application/json' });
    if (w.navigator && w.navigator.sendBeacon && w.navigator.sendBeacon(url, blob)) return;
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(function () {});
  }
  var ph = {
    track: function (event, props) { send(event, props); },
    trackOnce: function (key, event, props) {
      try {
        if (w.localStorage.getItem(ONCE + key) === 'true') return;
        w.localStorage.setItem(ONCE + key, 'true');
      } catch (e) {}
      send(event, props);
    },
    identify: function (userId, person) {
      if (dead() || !userId) return;
      var anon = getId();
      send('$create_alias', { alias: userId, distinct_id: anon });
      try {
        w.localStorage.setItem(ID_KEY, userId);
        w.localStorage.setItem(ID_KEY + ':id', '1');
      } catch (e) {}
      send('$identify', { $set: Object.assign({ platform: PLATFORM, is_internal: false }, person || {}) });
    },
    reset: function () {
      try {
        w.localStorage.setItem(ID_KEY, uuid());
        w.localStorage.removeItem(ID_KEY + ':id');
      } catch (e) {}
    },
    setOptOut: function (off) {
      try { w.localStorage.setItem(OPT, off ? 'true' : 'false'); } catch (e) {}
    },
    pageview: function () { send('$pageview'); }
  };
  w.ph = ph;
  ph.pageview();
})(window);
