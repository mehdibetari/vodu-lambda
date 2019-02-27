const request = require('request');
const cheerio = require('cheerio');
const h2p = require('html2plaintext');
const Slug = require('slugify');
const Store = require('ml_media-storage');

const NETFLIX_BASE_URL = 'https://media.netflix.com';

function getPoster (uri, name, year, id, logger, configKeys, callback) {
    
    request(NETFLIX_BASE_URL+uri, function(error, response, html){
        if(!error){
            
            const $ = cheerio.load(html);
            let posterUri = $('img','.nfo-poster-img-container').filter(function(){
                return ($(this).attr('src') === '/dist/img/no-key-art.jpg') ? false : $(this).attr('src');
            });
            const description = $('p','.nfo-intro').filter(function() {
                return $(this).html() !== '';
            });

            if (description && posterUri && posterUri !== '' && posterUri.length > 0) {
                
                posterUri = $(posterUri).attr('src');
                
                const props = {
                    sourceUrl: posterUri,
                    destinationPath: `posters/${year}${id}/`,
                    destinationFileName: `${Slug(name, { lower: true, remove: /[$*_+~.()'"!\-:@]/g })}-${year}.jpg`,
                    logger,
                    options: {
                        AWS_ACCESS_KEY: configKeys.S3.AWS_ACCESS_KEY,
                        AWS_SECRET_ACCESS_KEY: configKeys.S3.AWS_SECRET_ACCESS_KEY,
                        AWS_BUCKET_NAME: configKeys.S3.posters.AWS_BUCKET_NAME,
                        AWS_CF_BASE_URL: configKeys.S3.posters.AWS_CF_BASE_URL
                    }
                };
                Store(props, (path) => {
                    callback({'posterUrl': path, 'sourceUrl': posterUri, description: h2p(description)});
                });
            }
            else {                
                
                
                callback({});
            }
        }
        else {
            
            
            callback({});
        }
    });
}

exports.getPoster = getPoster;