var mocha = require('mocha'),
	chai = require('chai'),
	supertest = require('supertest'),
	expect = chai.expect,
	url = 'http://localhost:1337';

describe('API', function() {
	it.skip('Supports GET /gearclassification', function(done) {
		supertest(url).get('/gearclassification').end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('object');
			done();
		});
	});

	it.skip('Supports POST /gear', function(done) {
		supertest(url).post('/gear').send({}).end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('object');
			done();
		});
	});

	it.skip('Supports GET /gear/:id', function(done) {
		supertest(url).get('/gear/0').end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('object');
			done();
		});
	});

	it.skip('Supports PUT /gear/:id', function(done) {
		supertest(url).put('/gear/test').send({}).end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('object');
			done();
		});
	});

	it('Supports GET /gear/search/:location/:gear/:daterange', function(done) {
		supertest(url).get('/gear/search/copenhagen/marshall/20140830-20140902').end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('array');
			done();
		});
	});

	it.skip('Supports GET /gear/:id/bookings', function(done) {
		supertest(url).get('/gear/0/bookings').end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('array');
			done();
		});
	});

	it.skip('Supports GET /users/:id', function(done) {
		supertest(url).get('/users/0').end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('object');
			done();
		});
	});

	it.skip('Supports PUT /users/:id', function(done) {
		supertest(url).put('/users/:id').send({}).end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('object');
			done();
		});
	});

	it('Supports GET /users/:id/gear', function(done) {
		supertest(url).get('/users/0/gear').end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('array');
			done();
		});
	});

	it('Supports GET /users/:id/reservations', function(done) {
		supertest(url).get('/users/0/reservations').end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('array');
			done();
		});
	});

	it.skip('Supports GET /users/search/:string', function(done) {
		supertest(url).get('/users/search/chris%20hjorth').end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('array');
			done();
		});
	});

	it.skip('Supports POST /bookings', function(done) {
		supertest(url).post('/bookings').send({}).end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('object');
			done();
		});
	});

	it.skip('Supports PUT /bookings/:id', function(done) {
		supertest(url).put('/bookings/0').send({}).end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('object');
			done();
		});
	});

	it.skip('Supports DELETE /bookings/:id', function(done) {
		supertest(url).put('/bookings/0').send({}).end(function(err, res) {
			if(err) {
				throw err;
			}
			expect(res.headers['content-type']).to.equal('application/json');
			expect(res.body).to.be.an('object');
			done();
		});
	});

});
