let request = require('request');

const NETFLIX_BASE_URL = 'https://media.netflix.com';
const NETFLIX_API_PATH = '/gateway/v1';
const NETFLIX_UPCOMING_PATH = '/titles/upcoming';

function getUpcomingMedia (lang, callback) {
    const langPath = lang ? `/${lang}` : '/fr';
    const netflixApi = `${NETFLIX_BASE_URL}${NETFLIX_API_PATH}${langPath}${NETFLIX_UPCOMING_PATH}`;
    console.log('netflixApi', netflixApi);
    request(netflixApi, function(error, response) {
        var netflixUpcomings = JSON.parse(response.body)
        if(error || !netflixUpcomings.items || !netflixUpcomings.meta.result.totalItems) {
            console.log('Error : ', error);
            console.log('Response : ', response);
            return;
        }
        callback(netflixUpcomings);
    });
}

exports.getUpcomingMedia = getUpcomingMedia;