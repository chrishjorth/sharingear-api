/**
 * Security related utilities.
 * @author: Chris Hjorth
 */
var crypto = require('crypto'),
	sharingearSecret = '95b95a4a2e59ddc98136ce54b8a0f8d2';

module.exports = {
	generateFileName: generateFileName,
	getFileSecretProof: getFileSecretProof
}

/**
 * Generates a unique filename.
 * @return fileName in the format filenamehash_uniqueID. 
 */
function generateFileName(originalFileName) {
	var filenameHash, id;
	filenameHash = crypto.createHash('md5').update(originalFileName).digest('hex');
	id = crypto.randomBytes(20).toString('hex');
	return filenameHash + '_' + id;
}

function getFileSecretProof(filename, callback) {
	var hmac = crypto.createHmac('sha256', sharingearSecret);
	hmac.update(filename);
	return hmac.digest('hex');
}