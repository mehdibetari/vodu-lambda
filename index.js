const fs              = require('fs');
const async           = require('async');
const Filestore       = require('./store/Filestore');
const imdbScraper     = require('./scrapers/imdb-scraper');
const netflixScraper  = require('./scrapers/netflix-scraper');
const netflixProvider = require('./providers/netflix-provider');

// todo manual is on s3 store-tolookat/upcomings
const STORE_FOLDER = 'store/';
const STORE_NETFLIX_UPCOMING = 'netflix-upcoming/';
const languages = ['en', 'fr', 'es', 'pt_br', 'de'];
const videos = {
    fr: 'X3VDoJ7ZnKc',
    en: 'Y5aztl4h_kY',
    de: 'oPD6XGXXjI0',
    es: 'OxvTC53NWfw',
    pt_br: 'Y5aztl4h_kY'
};

function itemBuildWithImdbScrap (item, scrap) {
    item.actors    = scrap.actors;
    item.directors = scrap.directors;
    item.creators  = scrap.creators;
    item.summary   = scrap.summary;
    item.mediaLink = scrap.mediaLink;
    item.posterUrl = scrap.posterUrl;
    item.sourceUrl = scrap.sourceUrl;
    return item;
}

function updateUpcoming (newUpcomings, mediasCount, lang, configKeys, callback) {
    let upComings = [];
    let postersCpt = 0;
    async.mapSeries(newUpcomings, function(item, done) {
        imdbScraper.getMedia(item.name, getMediaStartYear(item), item.id, true, logger, configKeys, function(imdbInfos) {
            if (imdbInfos.posterUrl) postersCpt++;
            item = itemBuildWithImdbScrap(item, imdbInfos);
            if (item.uri) {
                netflixScraper.getPoster(item.uri, item.name, getMediaStartYear(item), item.id, logger, configKeys, function(netflixPoster) {
                    if (netflixPoster.posterUrl) postersCpt++;
                    item.posterUrl = netflixPoster.posterUrl || item.posterUrl;
                    item.sourceUrl = netflixPoster.sourceUrl || item.sourceUrl;
                    item.description = netflixPoster.description;
                    upComings.push(item);
                    done();
                });
            }
            else {
                upComings.push(item);
                done();
            }
        });
    }, function() {
        const logTrace = `### Lang: ${lang} POSTER DOWNLOADED => ${postersCpt}/${mediasCount}`;
        logger(logTrace);
        callback(upComings);
    });
}

function getMediaStartYear (media) {
    if (media.premiereDate === 'upcoming') {
        return new Date().getFullYear();
    }
    if (media.type !== 'series') {
        return media.sortDate.split('-')[0];
    }
    if (media.type === 'series' && media.firstSeason) {
        return Number(media.firstSeason);
    }
    if (media.type === 'series') {
        return Number(media.sortDate.split('-')[0])-(--media.seasons);
    }
}

function saveStore (upComings, language, configKeys, callback) {
    const props = {
        destination: `${STORE_FOLDER}${STORE_NETFLIX_UPCOMING}${language}.json`,
        logger,
        body:  JSON.stringify(upComings)
    };
    Filestore(props, configKeys, function(location){
        const msg = `File successfully written! - Check your at ${location}`;
        logger(msg);
        callback();
    });
}

function logger(logTrace) {
    const datetime = new Date();
    const completeLog = `${datetime.toLocaleString()} : ${logTrace}\n`;
    console.log('Trace succefully logged', completeLog);
    //todo logger file path to s3
    // fs.appendFile('./src/refresh-upcomings-logs.txt', completeLog, function(){
    // });
}

const refreshNetflixUpcoming = async (configKeys) => {
    const startMsg = `\NETFLIX REFRESH UPCOMINGS MEDIA STARTED ${Date.now()}`;
    logger(startMsg);
    async.mapSeries(languages, function(language, done) {
        netflixProvider.getUpcomingMedia(language, function(netflixUpcoming) {
            let newUpcomings = {};
            updateUpcoming(netflixUpcoming.items, netflixUpcoming.meta.result.totalItems, language, configKeys, function(items) {
                newUpcomings.timeStamp = Date.now();
                newUpcomings.totalItems = netflixUpcoming.meta.result.totalItems;
                newUpcomings.items = items;
                newUpcomings.videoId = videos[language];
                saveStore(newUpcomings, language, configKeys, function () {
                    done();
                });
            });
        });
    }, function () {
        logger('-----------------------------------');
    });
}

module.exports = refreshNetflixUpcoming;