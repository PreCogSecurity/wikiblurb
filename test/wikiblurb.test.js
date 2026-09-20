'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const PLUGIN_PATH = path.join(__dirname, '..', 'js', 'jquery.wikiblurb.js');

/**
 * Load the plugin into a minimal jQuery stub so it can run without a DOM.
 * Captures any $.ajax() calls made by the plugin for assertions.
 */
function loadPlugin() {
  const ajaxCalls = [];

  // The plugin calls $(this) to wrap the target element, so the stub must be
  // callable as well as carrying the $.fn / $.extend / $.ajax / $.error APIs.
  function fakeJQuery(selector) {
    return selector;
  }
  fakeJQuery.fn = {};
  fakeJQuery.extend = function () {
    return Object.assign(...arguments);
  };
  fakeJQuery.error = function (message) {
    throw new Error(message);
  };
  fakeJQuery.ajax = function (options) {
    ajaxCalls.push(options);
  };

  global.jQuery = fakeJQuery;
  global.$ = fakeJQuery;
  delete require.cache[require.resolve(PLUGIN_PATH)];
  require(PLUGIN_PATH);

  return { fakeJQuery, ajaxCalls };
}

/** Minimal jQuery-like element stub supporting the methods the plugin calls. */
function fakeElement() {
  const element = {
    html: function () {
      return element;
    },
    find: function () {
      return element;
    },
    each: function (fn) {
      fn.call(element);
      return element;
    }
  };
  return element;
}

function invoke(plugin, element, options) {
  plugin.call(element, options);
}

test('registers the plugin on jQuery.fn', () => {
  const { fakeJQuery } = loadPlugin();
  assert.strictEqual(typeof fakeJQuery.fn.wikiblurb, 'function');
});

test('builds the default API request URL', () => {
  const { fakeJQuery, ajaxCalls } = loadPlugin();
  invoke(fakeJQuery.fn.wikiblurb, fakeElement(), {});

  assert.strictEqual(ajaxCalls.length, 1);
  assert.strictEqual(
    ajaxCalls[0].url,
    'https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=text&section=0&page=Jimi_Hendrix&callback=?'
  );
});

test('honours custom wikiURL, apiPath, section and page options', () => {
  const { fakeJQuery, ajaxCalls } = loadPlugin();
  invoke(fakeJQuery.fn.wikiblurb, fakeElement(), {
    wikiURL: 'https://fallout.fandom.com/',
    apiPath: '',
    section: 4,
    page: 'Fallout'
  });

  assert.strictEqual(
    ajaxCalls[0].url,
    'https://fallout.fandom.com/api.php?action=parse&format=json&prop=text&section=4&page=Fallout&callback=?'
  );
});

test('omits the section parameter when section is null', () => {
  const { fakeJQuery, ajaxCalls } = loadPlugin();
  invoke(fakeJQuery.fn.wikiblurb, fakeElement(), { section: null });

  assert.strictEqual(
    ajaxCalls[0].url,
    'https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=text&page=Jimi_Hendrix&callback=?'
  );
});

test('replaces spaces in the page name with underscores', () => {
  const { fakeJQuery, ajaxCalls } = loadPlugin();
  invoke(fakeJQuery.fn.wikiblurb, fakeElement(), { page: 'Foo Bar Baz' });

  assert.ok(ajaxCalls[0].url.includes('page=Foo_Bar_Baz'));
});

test('throws a descriptive error for unknown methods', () => {
  const { fakeJQuery } = loadPlugin();
  assert.throws(
    () => invoke(fakeJQuery.fn.wikiblurb, fakeElement(), 'nope'),
    /Method "nope" does not exist/
  );
});