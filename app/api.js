/**
 * Entry point for the node.js based API of Sharingear.
 * @author: Chris Hjorth
 */

var restify = require('restify');

var server = restify.createServer({
	name: 'Sharingear REST API'
});

server.use(restify.CORS());
server.use(restify.fullResponse());
server.use(restify.bodyParser());

server.listen(1339, function() {
	console.log('%s listening at %s', server.name, server.url);
});

//ROUTES
server.get('/gear', getAllGear);

//ROUTE HANDLERS
function getAllGear(req, res, next) {
	res.send({
		gear: 'This should be a list of gear'
	});
	next();
}