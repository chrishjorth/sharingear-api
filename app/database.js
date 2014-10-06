/**
 * Database handling.
 * @author: Chris Hjorth
 */
/* !TODO: Handle server disconnects */

var mysql = require('mysql'),
	isIndexing = false,
	needToReindex = false,
	sharingearPool,
	sphinxPool;

sharingearPool = mysql.createPool({
	host: '173.194.247.144',
	port: 3306,
	user: 'root',
	password: '20mircea14chris',
	database: 'sharingear',
	supportBigNumbers: true //Required for working with Facebook IDs stored as bigint.
});

sphinxPool = mysql.createPool({
	host: '127.0.0.1',
	port: 9306
});

module.exports = {
	query: query,
	search: search,
	index: index
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

function search(searchString, paramArray, callback) {
	sphinxPool.getConnection(function(error, connection) {
		if(error) {
			callback('Error opening sphinx connection: ' + error);
			return;
		}
		connection.query(searchString, paramArray, function(error, rows) {
			callback(error, rows);
			connection.destroy();
		});
	});
}

function index(callback) {
	var childProcess, response;
	childProcess = require('child_process').spawn('sudo indexer', 'gear_delta --rotate');

	response = '';
	childProcess.on('data', function(buffer) {
		response += buffer.toString();
	});
	childProcess.on('end', function() {
		console.log('Done indexing: ' + response);
	});
}
