/**
 * Sends notifications to users.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var fs = require("fs"),
	_ = require("underscore"),
	SendGrid = require("sendgrid")("sharingear", "Shar1ng3ar_"),
	User = require("./user"),
	FROM_ADDRESS = "service@sharingear.com",

	BOOKING_PENDING_OWNER = 0,
	bookingPendingOwnerEmailSubject,
	bookingPendingOwnerEmailTextTemplate,
	bookingPendingOwnerEmailHTMLTemplate,
	BOOKING_PENDING_RENTER = 1,
	bookingPendingRenterEmailSubject,
	bookingPendingRenterEmailTextTemplate,
	bookingPendingRenterEmailHTMLTemplate,
	BOOKING_ACCEPTED_RENTER = 2,
	bookingAcceptedRenterEmailSubject,
	bookingAcceptedRenterEmailTextTemplate,
	bookingAcceptedRenterEmailHTMLTemplate,
	BOOKING_ACCEPTED_OWNER = 3,
	bookingAcceptedOwnerEmailSubject,
	bookingAcceptedOwnerEmailTextTemplate,
	bookingAcceptedOwnerEmailHTMLTemplate,
	BOOKING_DENIED = 4,
	bookingDeniedEmail,
	BOOKING_OWNER_RETURNED = 5,
	bookingOwnerReturnedEmailSubject,
	bookingOwnerReturnedEmailTextTemplate,
	bookingOwnerReturnedEmailHTMLTemplate,
	BOOKING_RENTER_RETURNED = 6,
	bookingRenterReturnedEmailSubject,
	bookingRenterReturnedEmailTextTemplate,
	bookingRenterReturnedEmailHTMLTemplate,
	BOOKING_ENDED_OWNER = 7,
	bookingEndedOwnerEmail,
	BOOKING_ENDED_RENTER = 8,
	bookingEndedRenterEmail,

	send;

_.templateSettings = {
	evaluate: /\{\{=(.+?)\}\}/g,
	interpolate: /\{\{(.+?)\}\}/g,
	escape: /\{\{-(.+?)\}\}/g
};

bookingPendingOwnerEmailSubject = "Someone wants to rent your gear, response needed – step 1 of 3";
bookingPendingOwnerEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/reservation_email_owner.txt", "utf8"));
bookingPendingOwnerEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/reservation_email_owner.html", "utf8"));

bookingPendingRenterEmailSubject = "You have requested gear – step 1 of 3 ";
bookingPendingRenterEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/reservation_email_renter.txt", "utf8"));
bookingPendingRenterEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/reservation_email_renter.html", "utf8"));

bookingAcceptedRenterEmailSubject = "Your gear request was accepted – step 2 of 3";
bookingAcceptedRenterEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/acceptance_renter.txt", "utf8"));
bookingAcceptedRenterEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/acceptance_renter.html", "utf8"));

bookingAcceptedOwnerEmailSubject = "You accepted gear request – wait for payment confirmation – step 2 of 3";
bookingAcceptedOwnerEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/acceptance_owner.txt", "utf8"));
bookingAcceptedOwnerEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/acceptance_owner.html", "utf8"));

//Defines an email to the renter of gear, sent on the event that the owner denied the booking
bookingDeniedEmail = {
	to: null,
	from: FROM_ADDRESS,
	subject: "Sharingear - your booking got denied",
	text: "Hi,\n\nunfortunately your booking got denied by the owner of the gear.\n\nSearch for other gear https://www.sharingear.com.\n\nHope you have more luck next time,\n\n- Sharingear"
};
bookingOwnerReturnedEmailSubject = "End booking and get paid - step 3 of 3";
bookingOwnerReturnedEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/end_booking_owner.txt", "utf8"));
bookingOwnerReturnedEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/end_booking_owner.html", "utf8"));

bookingRenterReturnedEmailSubject = "End booking and collect your deposit - step 3 of 3";
bookingRenterReturnedEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/end_booking_renter.txt", "utf8"));
bookingRenterReturnedEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/end_booking_renter.html", "utf8"));
//Defines an email to the owner of gear, sent on the event that the rental has ended successfully.
bookingEndedOwnerEmail = {
	to: null,
	from: FROM_ADDRESS,
	subject: "Sharingear - rental of your gear is completed",
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
	var emailParams,
		textTemplate,
		htmlTemplate,
		email;
	emailParams = {
		from: FROM_ADDRESS
	};
	switch(notificationType) {
		case BOOKING_PENDING_OWNER:
			emailParams.subject = bookingPendingOwnerEmailSubject;
			emailParams.text = bookingPendingOwnerEmailTextTemplate(notificationParameters);
			emailParams.html = bookingPendingOwnerEmailHTMLTemplate(notificationParameters);
			break;
		case BOOKING_PENDING_RENTER:
			emailParams.subject = bookingPendingRenterEmailSubject;
			emailParams.text = bookingPendingRenterEmailTextTemplate(notificationParameters);
			emailParams.html = bookingPendingRenterEmailHTMLTemplate(notificationParameters);
			break;
		case BOOKING_ACCEPTED_RENTER:
			emailParams.subject = bookingAcceptedRenterEmailSubject;
			emailParams.text = bookingAcceptedRenterEmailTextTemplate(notificationParameters);
			emailParams.html = bookingAcceptedRenterEmailHTMLTemplate(notificationParameters);
			break;
		case BOOKING_ACCEPTED_OWNER:
			emailParams.subject = bookingAcceptedOwnerEmailSubject;
			emailParams.text = bookingAcceptedOwnerEmailTextTemplate(notificationParameters);
			emailParams.html = bookingAcceptedOwnerEmailHTMLTemplate(notificationParameters);
			break;
		case BOOKING_DENIED:
			emailParams = bookingDeniedEmail;
			break;
		case BOOKING_OWNER_RETURNED:
			emailParams.subject = bookingOwnerReturnedEmailSubject;
			emailParams.text = bookingOwnerReturnedEmailTextTemplate(notificationParameters);
			emailParams.html = bookingOwnerReturnedEmailHTMLTemplate(notificationParameters);
			break;
		case BOOKING_RENTER_RETURNED:
			emailParams.subject = bookingRenterReturnedEmailSubject;
			emailParams.text = bookingRenterReturnedEmailTextTemplate(notificationParameters);
			emailParams.html = bookingRenterReturnedEmailHTMLTemplate(notificationParameters);
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
		if(emailParams.html) {
			htmlTemplate = _.template(emailParams.html);
			emailParams.html = htmlTemplate(notificationParameters);
		}
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
	BOOKING_PENDING_RENTER: BOOKING_PENDING_RENTER,
	BOOKING_ACCEPTED_RENTER: BOOKING_ACCEPTED_RENTER,
	BOOKING_ACCEPTED_OWNER: BOOKING_ACCEPTED_OWNER,
	BOOKING_DENIED: BOOKING_DENIED,
	BOOKING_OWNER_RETURNED: BOOKING_OWNER_RETURNED,
	BOOKING_RENTER_RETURNED: BOOKING_RENTER_RETURNED,
	BOOKING_ENDED_OWNER: BOOKING_ENDED_OWNER,
	BOOKING_ENDED_RENTER: BOOKING_ENDED_RENTER,

	send: send
};
