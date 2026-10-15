// -----------------------------------------------------------------------------
// The "SMHI forecast" widget and the "Read the SMHI forecast" scene action.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { FORECAST, createFakeSmhi, createWorld } from './helpers/world.js';

const LANGS = ['en', 'fr', 'de', 'es'];

async function widget(gladys, options) {
  const ack = await gladys.fake.widgetGet('forecast', options);
  assert.equal(ack.success, true, ack.error);
  return ack.data.content;
}

test('the widget fits the vocabulary and the budget of the core, in every language and unit', async () => {
  const { gladys, app, devices } = await createWorld();
  try {
    for (const language of LANGS) {
      for (const units of ['metric', 'us']) {
        const content = await widget(gladys, {
          settings: { device: devices[0].external_id },
          language,
          units,
        });
        assert.deepEqual(validateWidgetContent(content), [], `${language} / ${units}`);
        assert.deepEqual(
          content.components.map((component) => component.type),
          ['text', 'text', 'value', 'value', 'value', 'chart', 'status'],
        );
      }
    }
  } finally {
    app.stop();
  }
});

test('the widget content: current weather, 24 hours, warnings first, then the days', async () => {
  const { gladys, app } = await createWorld();
  try {
    const content = await widget(gladys, { language: 'en' });
    const [heading, caption, temperature, feelsLike, wind, chart, status] = content.components;
    assert.equal(heading.text, 'SMHI Home');
    assert.equal(caption.text, 'Overcast · updated 13:20');
    assert.deepEqual([temperature.value, temperature.unit], [10.4, '°C']);
    assert.deepEqual([feelsLike.value, feelsLike.label], [7.3, 'Feels like']);
    assert.deepEqual([wind.value, wind.unit], [3.4, 'm/s']);
    assert.equal(chart.series[0].points.length, 24);
    assert.deepEqual(status.items[0], {
      label: 'Warning · Orange',
      value: 'Wind',
      icon: 'alert-triangle',
      color: 'warning',
    });
    assert.deepEqual(status.items[2], {
      label: 'Fri 3 · Light rain',
      value: '2° / 6° · 4.1 mm',
      icon: 'cloud-drizzle',
    });
    assert.equal(status.items.length, 7, 'one warning and six days');

    const us = await widget(gladys, { language: 'en', units: 'us' });
    assert.deepEqual([us.components[2].value, us.components[2].unit], [50.7, '°F']);
    assert.deepEqual([us.components[4].value, us.components[4].unit], [7.6, 'mph']);
    assert.equal(us.components[6].items[2].value, '35° / 43° · 0.16 in');
  } finally {
    app.stop();
  }
});

test('the widget without device, or without forecast, says so', async () => {
  const none = await createWorld({ created: false });
  try {
    const content = await widget(none.gladys, { language: 'fr' });
    assert.deepEqual(content.components, [
      { type: 'text', variant: 'body', text: "Ajoutez d'abord un appareil SMHI dans Gladys." },
    ]);
  } finally {
    none.app.stop();
  }
  const down = await createWorld({ smhi: createFakeSmhi({ forecast: () => 503 }) });
  try {
    const content = await widget(down.gladys, { language: 'es' });
    assert.deepEqual(validateWidgetContent(content), []);
    assert.equal(content.components[1].text, 'Todavía no hay previsión.');
  } finally {
    down.app.stop();
  }
});

test('the scene action reads one day of the forecast', async () => {
  const { gladys, app, devices } = await createWorld({ config: { language: 'en' } });
  try {
    const ack = await gladys.fake.sceneAction('get_forecast', {
      device: devices[0].external_id,
      day: 'tomorrow',
    });
    assert.deepEqual(ack.data.outputs, {
      temperature_min: 1.9,
      temperature_max: 5.9,
      precipitation: 4.1,
      wind_gust_max: 6.6,
      thunder_probability_max: 2,
      condition: 'Light rain',
      summary: 'Tomorrow in SMHI Home: Light rain, 2 to 6 °C, 4.1 mm of precipitation.',
    });
    const today = await gladys.fake.sceneAction('get_forecast', {
      device: devices[0].external_id,
      day: 'today',
    });
    assert.equal(today.data.outputs.temperature_max, 10.4);

    const unknown = await gladys.fake.sceneAction('get_forecast', {
      device: 'ext:test-integration:place:gone',
      day: 'today',
    });
    assert.equal(unknown.success, false);
    assert.match(unknown.error, /unknown: pick it again/);
  } finally {
    app.stop();
  }
});

test('the scene action reads SMHI when no forecast is in memory', async () => {
  let down = true;
  const smhi = createFakeSmhi({ forecast: () => (down ? 503 : FORECAST) });
  const { gladys, app, devices } = await createWorld({ smhi, config: { language: 'es' } });
  try {
    const fields = { device: devices[0].external_id, day: 'day_after' };
    const failed = await gladys.fake.sceneAction('get_forecast', fields);
    assert.equal(failed.success, false);
    assert.equal(failed.error, 'Todavía no hay previsión para este día.');

    down = false;
    const calls = smhi.forecastCalls();
    const ack = await gladys.fake.sceneAction('get_forecast', fields);
    assert.equal(smhi.forecastCalls(), calls + 1);
    assert.match(ack.data.outputs.summary, /^Pasado mañana en SMHI Home: /);
  } finally {
    app.stop();
  }
});
