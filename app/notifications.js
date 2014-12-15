/**
 * Sends notifications to users.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var _ = require("underscore"),
	SendGrid = require("sendgrid")("sharingear", "Shar1ng3ar_"),
	User = require("./user"),
	FROM_ADDRESS = "service@sharingear.com",

	BOOKING_PENDING_OWNER = 0,
	bookingPendingOwnerEmail,
	BOOKING_ACCEPTED = 1,
	bookingAcceptedEmail,
	BOOKING_DENIED = 2,
	bookingDeniedEmail,
	BOOKING_OWNER_RETURNED = 3,
	bookingOwnerReturnedEmail,
	BOOKING_RENTER_RETURNED = 4,
	bookingRenterReturnedEmail,
	BOOKING_ENDED_OWNER = 5,
	bookingEndedOwnerEmail,
	BOOKING_ENDED_RENTER = 6,
	bookingEndedRenterEmail,

	send;

//Defines an email to the owner of gear, sent on the event that another user has successfully booked the gear
bookingPendingOwnerEmail = {
	to: null,
	from: FROM_ADDRESS,
	subject: "Sharingear - new booking",
	text: "Hi,\n\nyour gear has been booked!\n\nGo to http://www.sharingear.com to confirm or deny this booking.\n\nHave a good one,\n\n- Sharingear"
};
//Defines an email to the renter of gear, sent on the event that the owner accepted the booking
bookingAcceptedEmail = {
	to: null,
	from: FROM_ADDRESS,
	subject: "Sharingear - your booking got accepted",
	text: "Hi,\n\nyour booking has been accepted!\n\nCheck it out on http://www.sharingear.com.\n\nHope you enjoy it,\n\n- Sharingear"
};
//Defines an email to the renter of gear, sent on the event that the owner denied the booking
bookingDeniedEmail = {
	to: null,
	from: FROM_ADDRESS,
	subject: "Sharingear - your booking got denied",
	text: "Hi,\n\nunfortunately your booking got denied by the owner of the gear.\n\nSearch for other gear http://www.sharingear.com.\n\nHope you have more luck next time,\n\n- Sharingear"
};
//Defines an email to the renter of gear, sent on the event that the owner has marked the booking successfully ended
bookingOwnerReturnedEmail = {
	to: null,
	from: FROM_ADDRESS,
	subject: "Sharingear - please confirm you returned the gear",
	text: "Hi,\n\nthe owner of the gear you have rented has marked the rental as completed.\n\nPlease go to http://www.sharingear.com to end the booking. Once you have done this you will receive your deposit back on your account.\n\nCheers,\n\n- Sharingear"
};
//Defines an email to the owner of gear, sent on the event that the renter has marked the booking successfully ended
bookingRenterReturnedEmail = {
	to: null,
	from: FROM_ADDRESS,
	subject: "Sharingear - please confirm the return of your gear",
	text: "Hi,\n\na renter of your gear has marked the rental as completed.\n\nPlease go to http://www.sharingear.com to end the booking. Once you have done this you will receive your payment.\n\nCheers,\n\n- Sharingear"
};
//Defines an email to the owner of gear, sent on the event that the rental has ended successfully.
bookingEndedOwnerEmail = {
	to: null,
	from: FROM_ADDRESS,
	subject: "Sharingear - rental completed",
	text: "Hi,\n\nthe rental of your gear has been completed. We hope you enjoyed the experience.\n\n All the best,\n\n- Sharingear"
};
//Defines an email to the renter of gear, sent on the event that the rental has ended successfully
bookingEndedRenterEmail = {
	to: null,
	from: FROM_ADDRESS,
	subject: "Sharingear - rental completed",
	text: "Hi,\n\nyour rental of gear has been completed. We hope you enjoyed the experience.\n\n See you soon,\n\n- Sharingear"
};

send = function(notificationType, notificationParameters, recipientID) {
	var emailParams = null,
		textTemplate,
		email;
	switch(notificationType) {
		case BOOKING_PENDING_OWNER:
			emailParams = bookingPendingOwnerEmail;
			break;
		case BOOKING_ACCEPTED:
			emailParams = bookingAcceptedEmail;
			break;
		case BOOKING_DENIED:
			emailParams = bookingDeniedEmail;
			break;
		case BOOKING_OWNER_RETURNED:
			emailParams = bookingOwnerReturnedEmail;
			break;
		case BOOKING_RENTER_RETURNED:
			emailParams = bookingRenterReturnedEmail;
			break;
		case BOOKING_ENDED_OWNER:
			emailParams = bookingEndedOwnerEmail;
			break;
		case BOOKING_ENDED_RENTER:
			emailParams = bookingEndedRenterEmail;
			break;
		default:
			return;
	}
	User.readUser(recipientID, function(error, recipient) {
		if(error) {
			console.log("Error retrieving recipient: " + error);
			return;
		}
		emailParams.to = recipient.email;
		textTemplate = _.template(emailParams.text);
		emailParams.text = textTemplate(notificationParameters);
		email = new SendGrid.Email(emailParams);
		SendGrid.send(email, function(error) {
			if(error) {
				console.log("Error sending notification email: " + error);
				return;
			}
		});
	});
};

module.exports = {
	BOOKING_PENDING_OWNER: BOOKING_PENDING_OWNER,
	BOOKING_ACCEPTED: BOOKING_ACCEPTED,
	BOOKING_DENIED: BOOKING_DENIED,
	BOOKING_OWNER_RETURNED: BOOKING_OWNER_RETURNED,
	BOOKING_RENTER_RETURNED: BOOKING_RENTER_RETURNED,
	BOOKING_ENDED_OWNER: BOOKING_ENDED_OWNER,
	BOOKING_ENDED_RENTER: BOOKING_ENDED_RENTER,

	send: send
};
