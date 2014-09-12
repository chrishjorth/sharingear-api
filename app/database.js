/**
 * Database handling.
 * @author: Chris Hjorth
 */
/* !TODO: Handle server disconnects */

var mysql = require('mysql'),
	sharingearPool;

sharingearPool = mysql.createPool({
        host: '173.194.247.144',
        port: 3306,
        user: 'root',
        password: '20mircea14chris',
        database: 'sharingear',
        supportBigNumbers: true //Required for working with Facebook IDs stored as bigint.
});

module.exports = {
	query: query
};

function query(queryString, paramArray, callback) {
	sharingearPool.getConnection(function(error, connection) {
		if(error) {
			console.log('Error opening database connection.');
			callback(error);
			return;
		}
		connection.query(queryString, paramArray, function(error, rows) {
			if(error) {
				console.log('Error running query: ' + queryString + '. ' + error.code);
			}
			callback(error, rows);
			connection.destroy();
		});
	});
};