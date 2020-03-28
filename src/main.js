const Apify = require('apify');
const transformSchema = require('./transform-schema');

const LATEST = 'LATEST';
const removeEmoji = (countryTitle) => {
    return countryTitle.replace(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g, '').trim();
};

const getValue = (schema, data, prop) => {
    const value = schema[prop];
    return value === undefined ? 'NA' : data[schema[prop]];
};
const transformCoreData = (schema, countryData) => {
    return {
        infected: getValue(schema, countryData, 'infected'),
        tested: getValue(schema, countryData, 'tested'),
        recovered: getValue(schema, countryData, 'recovered'),
        deceased: getValue(schema, countryData, 'deceased'),

    };
};
Apify.main(async () => {
    const kvStore = await Apify.openKeyValueStore('COVID-19-WORLD');
    const dataset = await Apify.openDataset('COVID-19-WORLD-HISTORY');

    const response = await Apify.utils.requestAsBrowser({
        url: 'https://raw.githubusercontent.com/apifytech/apify-docs/master/ext/covid_api_list.json',
        abortFunction: () => false,
        json: true,
    });
    const data = { countries: [] };
    const dataSources = response.body;
    for (const source of dataSources) {
        console.log('Processiong: ', source.title);
        const { body: countryData } = await Apify.utils.requestAsBrowser({
            url: source.latestApi.url,
            abortFunction: () => false,
            json: true,
        });
        const countryName = removeEmoji(source.title);
        const countrySchema = transformSchema[countryName];

        if (countrySchema) {
            data.countries.push({
                ...transformCoreData(countrySchema, countryData),
                country: countryName,
                moreData: source.latestApi.url,
                historyData: source.historyApi.url,
                sourceUrl: countryData.sourceUrl,
                lastUpdatedSource: countryData.lastUpdatedSource,
                lastUpdatedApify: countryData.lastUpdatedApify,
            });
        }
    }
    const now = new Date();
    data.lastUpdated = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes())).toISOString();

    // Compare and save to history
    let latest = await kvStore.getValue(LATEST);
    if (!latest) {
        await kvStore.setValue('LATEST', data);
        latest = data;
    }
    delete latest.lastUpdated;
    const actual = Object.assign({}, data);
    delete actual.lastUpdatedAt;

    if (JSON.stringify(latest) !== JSON.stringify(actual)) {
        await dataset.pushData(data);
    }

    await kvStore.setValue('LATEST', data);
    await Apify.pushData(data);
    console.log('Done.');
});
