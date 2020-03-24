
const Apify = require('apify');

const LATEST = 'LATEST';

Apify.main(async () => {
    /**
     * Actor code
     */
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

        if (source.title.includes('USA')) {
            data.countries.push({ country: source.title, ...countryData[0] });
        } else {
            data.countries.push({ country: source.title, ...countryData });
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
