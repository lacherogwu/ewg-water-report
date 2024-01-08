import * as cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12';

Deno.serve(async req => {
	try {
		const params = new URL(req.url).searchParams;
		const zipCode = params.get('zipCode')?.trim();
		if (!zipCode) throw new Error('Zip code is required');

		const cityCode = await getCityCode(zipCode);
		const cityData = await getCityData(cityCode);

		return new Response(JSON.stringify(cityData), {
			headers: {
				'content-type': 'application/json',
			},
		});
	} catch (err) {
		return new Response(err.message, {
			status: 404,
		});
	}
});

async function getCityCode(zipCode: string) {
	const res = await fetch(`https://www.ewg.org/tapwater/search-results.php?zip5=${zipCode}&searchtype=zip`);
	const html = await res.text();
	const match = html.match(/system\.php\?pws=(?<cityCode>\w+)/);
	if (!match?.groups?.cityCode) throw new Error('No match found');

	return match.groups.cityCode;
}

async function getCityData(cityCode: string) {
	const url = `https://www.ewg.org/tapwater/system.php?pws=${cityCode}`;
	const res = await fetch(url);
	const html = await res.text();

	const $ = cheerio.load(html);

	type Item = {
		name: string;
		detectTimes: string;
		detectLevels: {
			thisUtility: string;
			ewgHealthGuideline: string;
			legalLimit: string | null;
		};
	};
	const items: Item[] = [];

	$('#contams_above_hbl .contaminant-grid-item').each((_, el) => {
		const contaminentEl = $(el).find('div.contaminant-name');
		const name = contaminentEl.find('h3').text();
		const detectTimes = contaminentEl.find('span.detect-times-greater-than').text();
		const detectLevelsEls = contaminentEl.find('div.detect-levels-overview > div');
		const detectLevels = {
			thisUtility: detectLevelsEls.eq(0).find('span:nth-child(2)').text() || 'Not Available',
			ewgHealthGuideline: detectLevelsEls.eq(1).find('span:nth-child(2)').text() || 'Not Available',
			legalLimit: detectLevelsEls.eq(2).find('span:nth-child(2)').text() || null,
		};

		items.push({
			name,
			detectTimes,
			detectLevels,
		});
	});

	return items;
}
