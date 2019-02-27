const AWS = require('aws-sdk');

const Filestore = (props, configKeys, callback) => {
    const awsS3Connect = new AWS.S3({
        accessKeyId: configKeys.S3.AWS_ACCESS_KEY,
        secretAccessKey: configKeys.S3.AWS_SECRET_ACCESS_KEY
    });
    _saveOnS3(props, configKeys, awsS3Connect, callback);
};

const _saveOnS3 = ({destination, logger, body}, configKeys, awsS3Connect, callback) => {
    const params = {
        Bucket: configKeys.S3.AWS_BUCKET_NAME,
        Key: destination,
        Body: body
    };
    awsS3Connect.upload(params, function(s3Err, data) {
        if (s3Err) throw s3Err;
        console.log(`File uploaded successfully at ${data.Location}`);
        logger(`File uploaded successfully at ${data.Location}`);
        callback(`https://${configKeys.S3.AWS_CF_BASE_URL}${destination}`);
    });
};

module.exports = Filestore;
