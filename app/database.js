/**
 * Database handling.
 * @author: Chris Hjorth
 */
/* !TODO: Handle server disconnects */

var mysql = require('mysql'),
	child_process = require('child_process'),
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
	var spawn, indexer, response;

	console.log('spawning indexer');
	//indexer = spawn('sudo indexer', ['gear_delta', '--rotate']);
	indexer = child_process.spawn('ls', ['-la']);
	//ls -la /usr
	console.log('process spawned');

	//response = '';
	/*indexer.stderr.on('data', function(data) {
		console.log('Error indexing: ');
		console.log(data);
	});*/
	indexer.stdout.on('data', function(data) {
		console.log('process data');
		console.log(data);
		//response += data;
	});
	indexer.on('close', function(code) {
		console.log('Done indexing with code: ');
		console.log(code);
	});

	console.log('wtf');
	
}
