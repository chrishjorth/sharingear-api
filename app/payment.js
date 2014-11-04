/**
 * Payment handling.
 * @author: Chris Hjorth
 */
var braintree = require('braintree'),
	MERCHANT_ID = 'jxrjjy5wv68wx8sw',
	gateway;

gateway = braintree.connect({
	environment: braintree.Environment.Sandbox,
	merchantId: MERCHANT_ID,
	publicKey: 'cwx9n7wqrz2q374b',
	privateKey: '1033b445dc8d3e79a45be7b5bad58ea7'
});

module.exports = {
	registerSubmerchant: registerSubmerchant
};

function registerSubmerchant(user) {
	var subMerchantAccountParameters;
	subMerchantAccountParameters = {
		individual: {
			firstName: user.name,
			lastName: user.surname,
			email: user.email,
			phone: user.phone,
			dateOfBirth: user.birthdate,
			ssn: '', //We do not provide social security numbers
			address: {
				streetAddress: user.address,
				locality: user.city,
				region: user.region,
				postalCode: user.postal_code
			}
		},
		funding: {
			descriptor: 'Sharingear',
			destination: braintree.MerchantAccount.FundingDestination.Bank,
			email: 'chris@sharingear.com',
			mobilePhone: '+4530273907',
			accountNumber: '', //Need to get this from the user
			routingNumber: '' //Need to get this from the user
		},
		tosAccepted: true,
		masterMerchantAccountId: MERCHANT_ID,
		id: user.id
	};

	gateway.merchantAccount.create(subMerchantAccountParameters, function(error, result) {
		if(error) {
			callback('Error creating submerchant account: ' + error);
			return;
		}
		console.log('success: ' + result.success);
		console.log('status: ' + result.merchantAccount.status);
		console.log('id: ' + result.merchantAccount.id);
		console.log('master status: ' + result.merchantAccount.masterMerchantAccount.status);
		callback(null, result.merchantAccount);
	});
}
