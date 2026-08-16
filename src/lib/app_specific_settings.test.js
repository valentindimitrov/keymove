import AppSpecificSettings from './app_specific_settings.js';
import { validateAppSpecificSettings } from './app_specific_settings_schema.js';

describe('AppSpecificSettings', () => {
  test('indexes discovered settings by host', () => {
    expect(AppSpecificSettings.getSettingsForHost('mail.google.com')).toMatchObject({
      host: 'mail.google.com',
      relevant_words: ['forward', 'compose', 'reply', 'starred'],
    });
  });

  test('returns empty settings for an unknown host', () => {
    expect(AppSpecificSettings.getSettingsForHost('example.com')).toEqual({});
  });

  test('rejects malformed nested JSON with its source path', () => {
    expect(() =>
      validateAppSpecificSettings(
        {
          host: 'example.com',
          synonyms: { directed: { save: ['store', 42] } },
        },
        'fixture.json',
      ),
    ).toThrow('fixture.json.synonyms.directed.save[1] must be a non-empty string');
  });

  test('rejects unknown properties instead of silently ignoring typos', () => {
    expect(() =>
      validateAppSpecificSettings(
        {
          host: 'example.com',
          relevent_words: ['save'],
        },
        'fixture.json',
      ),
    ).toThrow('fixture.json.relevent_words is not a supported property');
  });
});
