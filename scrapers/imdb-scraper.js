const request = require('request');
const cheerio = require('cheerio');
const async = require('async');
const Slug = require('slugify');
const stringSimilarity = require('string-similarity');
const Store = require('ml_media-storage');

const imdbBaseUrl = 'http://www.imdb.com';
const imdbSearchStartUrl = '/find?ref_=nv_sr_fn&q=';
const imdbSearchEndUrl = '&s=all';

function getMediaListUrl(name, year) {
  return (
    imdbBaseUrl +
    imdbSearchStartUrl +
    encodeURIComponent(`${name}+${year}`) +
    imdbSearchEndUrl
  );
}

function listScrapping(mediasFounded, titleToFound, name, year, id, $, lock, enableDownload, logger, configKeys, callback) {
  async.eachSeries(mediasFounded, function(media, done) {
      const mediaTitle = $(media)
        .text()
        .toLowerCase()
        .replace(/\s/g, "")
        .replace(":", "")
        .replace("(tvseries)", "")
        .replace("(tvepisode)", "")
        .replace("(video)", "");
      const title = titleToFound
        .toLowerCase()
        .replace(/\s/g, "")
        .replace(":", "");
      const similarity = stringSimilarity.compareTwoStrings(mediaTitle, title);
      let textExactlyMatch = mediaTitle === title;
      let textExactlyStart = mediaTitle.indexOf(title) === 0;
      if (
        !lock &&
        (textExactlyMatch || textExactlyStart || similarity > 0.79)
      ) {
        lock = true;
        let mediaLink = $(media)
          .find("a")
          .attr("href");
        request(imdbBaseUrl + mediaLink, function(
          mediaError,
          mediaResponse,
          mediaHtml
        ) {
          if (!mediaError) {
            let $ = cheerio.load(mediaHtml);
            let posterUrl = $(".poster img").attr("src");
            let actors = "";
            $('.credit_summary_item span[itemprop*="actors"] a span').each(
              function(i) {
                actors += $(this).text();
                actors +=
                  i <
                  $('.credit_summary_item span[itemprop*="actors"] a span')
                    .length -
                    1
                    ? ", "
                    : "...";
              }
            );
            let directors = "";
            $('.credit_summary_item span[itemprop*="director"] a span').each(
              function(i) {
                directors += $(this).text();
                directors +=
                  i <
                  $('.credit_summary_item span[itemprop*="director"] a span')
                    .length -
                    1
                    ? ", "
                    : "...";
              }
            );
            let creators = "";
            $('.credit_summary_item span[itemprop*="creator"] a span').each(
              function(i) {
                creators += $(this).text();
                creators +=
                  i <
                  $('.credit_summary_item span[itemprop*="creator"] a span')
                    .length -
                    1
                    ? ", "
                    : "...";
              }
            );
            let summary = "";
            summary += $('.summary_text[itemprop*="description"]').text();

            if (enableDownload) {
              const props = {
                sourceUrl: posterUrl,
                destinationPath: `posters/${year}${id}/`,
                destinationFileName: `${Slug(name, {
                  lower: true,
                  remove: /[$*_+~.()'"!\-:@]/g
                })}-${year}.jpg`,
                logger,
                options: {
                  AWS_ACCESS_KEY: configKeys.S3.AWS_ACCESS_KEY,
                  AWS_SECRET_ACCESS_KEY: configKeys.S3.AWS_SECRET_ACCESS_KEY,
                  AWS_BUCKET_NAME: configKeys.S3.posters.AWS_BUCKET_NAME,
                  AWS_CF_BASE_URL: configKeys.S3.posters.AWS_CF_BASE_URL
                }
              };
              Store(props, path => {
                callback({
                  actors: actors,
                  posterUrl: path,
                  sourceUrl: posterUrl,
                  mediaLink: mediaLink,
                  directors: directors,
                  creators: creators,
                  summary: summary
                });
              });
            } else {
              callback({
                actors: actors,
                mediaLink: mediaLink,
                directors: directors,
                creators: creators,
                summary: summary
              });
            }
          } else {
            callback({});
          }
        });
        return false;
      } else {
        done();
      }
    },
    function() {
      callback({});
    }
  );
}
function getMedia(name, year, id, enableDownload, logger, configKeys, callback) {
  let url = getMediaListUrl(name, year);
  let lock = false;

  request(url, function(mediasError, mediasResponse, mediasHtml) {
    if (!mediasError) {
      let titleToFound = name + " (" + year + ")";
      let $ = cheerio.load(mediasHtml);
      let mediasFounded = $(".findList tbody tr.findResult td.result_text");
      if (!mediasFounded || mediasFounded.length < 1) {
        url = getMediaListUrl(name, --year);
        request(url, function(mediasError, mediasResponse, mediasHtml) {
          titleToFound = name + " (" + year + ")";
          $ = cheerio.load(mediasHtml);
          mediasFounded = $(".findList tbody tr.findResult td.result_text");
          if (!mediasFounded || mediasFounded.length < 1) {
            url = getMediaListUrl(name, --year);
            request(url, function(mediasError, mediasResponse, mediasHtml) {
              titleToFound = name + " (" + year + ")";
              $ = cheerio.load(mediasHtml);
              mediasFounded = $(".findList tbody tr.findResult td.result_text");
              if (!mediasFounded || mediasFounded.length < 1) {
                let now = new Date();
                year = now.getFullYear();
                url = getMediaListUrl(name, year);
                request(url, function(mediasError, mediasResponse, mediasHtml) {
                  titleToFound = name + " (" + year + ")";
                  $ = cheerio.load(mediasHtml);
                  mediasFounded = $(
                    ".findList tbody tr.findResult td.result_text"
                  );
                  if (!mediasFounded || mediasFounded.length < 1) {
                    callback({});
                  } else {
                    listScrapping(mediasFounded, titleToFound, name, year, id, $, lock, enableDownload, logger, configKeys, callback);
                  }
                });
              } else {
                listScrapping(mediasFounded, titleToFound, name, year, id, $, lock, enableDownload, logger, configKeys, callback);
              }
            });
          } else {
            listScrapping(mediasFounded, titleToFound, name, year, id, $, lock, enableDownload, logger, configKeys, callback);
          }
        });
      } else {
        listScrapping(mediasFounded, titleToFound, name, year, id, $, lock, enableDownload, logger, configKeys, callback);
      }
    } else {
      callback({});
    }
  });
}

exports.getMedia = getMedia;
