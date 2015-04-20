/**
 * Sends notifications to users.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var fs = require("fs"),
    _ = require("underscore"),
    SendGrid = require("sendgrid")("sharingear", "Shar1ng3ar_"),
    FROM_ADDRESS = "service@sharingear.com",

    BOOKING_PENDING_RENTER = 31,
    bookingPendingRenterEmailSubject,
    bookingPendingRenterEmailTextTemplate,
    bookingPendingRenterEmailHTMLTemplate,
    BOOKING_ACCEPTED_RENTER = 21,
    bookingAcceptedRenterEmailSubject,
    bookingAcceptedRenterEmailTextTemplate,
    bookingAcceptedRenterEmailHTMLTemplate,
    BOOKING_DENIED = 41,
    bookingDeniedEmail,
    /*BOOKING_OWNER_RETURNED = 5,
    bookingOwnerReturnedEmailSubject,
    bookingOwnerReturnedEmailTextTemplate,
    bookingOwnerReturnedEmailHTMLTemplate,*/
    BOOKING_RENTER_RETURNED = 6,
    bookingRenterReturnedEmailSubject,
    bookingRenterReturnedEmailTextTemplate,
    bookingRenterReturnedEmailHTMLTemplate,
    BOOKING_ENDED_OWNER = 7,
    bookingEndedOwnerEmail,
    BOOKING_ENDED_RENTER = 8,
    bookingEndedRenterEmail,
    RECEIPT_RENTER = 9,
    receiptRenterEmailSubject,
    receiptRenterEmailTextTemplate,
    receiptRenterEmailHTMLTemplate,

    OWNER_1_REQUEST = 0,
    owner1RequestEmailSubject,
    owner1RequestEmailHTMLTemplate,
    owner1RequestEmailTextTemplate,
    OWNER_2_ACCEPT = 1,
    owner2AcceptEmailSubject,
    owner2AcceptEmailHTMLTemplate,
    owner2AcceptEmailTextTemplate,
    OWNER_3_PICKUPREMINDER = 2,
    owner3PickupReminderEmailSubject,
    owner3PickupReminderEmailHTMLTemplate,
    owner3PickupReminderEmailTextTemplate,
    OWNER_4_DELIVERYREMINDER = 3,
    owner4DeliveryReminderEmailSubject,
    owner4DeliveryReminderEmailHTMLTemplate,
    owner4DeliveryReminderEmailTextTemplate,
    OWNER_5_END = 4,
    owner5EndEmailSubject,
    owner5EndEmailHTMLTemplate,
    owner5EndEmailTextTemplate,
    OWNER_6_RECEIPT = 5,
    owner6ReceiptEmailSubject,
    owner6ReceiptEmailHTMLTemplate,
    owner6ReceiptEmailTextTemplate,

    send;

_.templateSettings = {
    evaluate: /\{\{=(.+?)\}\}/g,
    interpolate: /\{\{(.+?)\}\}/g,
    escape: /\{\{-(.+?)\}\}/g
};

owner1RequestEmailSubject = "Someone wants to rent your gear, response needed – step 1 of 3";
owner1RequestEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_1_request.html", "utf8"));
owner1RequestEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_1_request.txt", "utf8"));

owner2AcceptEmailSubject = "You accepted gear request – step 2 of 3";
owner2AcceptEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_2_accept.html", "utf8"));
owner2AcceptEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_2_accept.txt", "utf8"));

owner3PickupReminderEmailSubject = "You have a rental coming up";
owner3PickupReminderEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_3_pickupreminder.html", "utf8"));
owner3PickupReminderEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_3_pickupreminder.txt", "utf8"));

owner4DeliveryReminderEmailSubject = "You have a delivery coming up";
owner4DeliveryReminderEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_4_deliveryreminder.html", "utf8"));
owner4DeliveryReminderEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_4_deliveryreminder.txt", "utf8"));

owner5EndEmailSubject = "End booking and get paid - step 3 of 3";
owner5EndEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_5_end.html", "utf8"));
owner5EndEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_5_end.txt", "utf8"));

owner6ReceiptEmailSubject = "Sharingear Booking Receipt";
owner6ReceiptEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_6_receipt.html", "utf8"));
owner6ReceiptEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_6_receipt.txt", "utf8"));



bookingPendingRenterEmailSubject = "You have requested gear – step 1 of 3 ";
bookingPendingRenterEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/reservation_email_renter.html", "utf8"));
bookingPendingRenterEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/reservation_email_renter.txt", "utf8"));

bookingAcceptedRenterEmailSubject = "Your gear request was accepted – step 2 of 3";
bookingAcceptedRenterEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/acceptance_renter.txt", "utf8"));
bookingAcceptedRenterEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/acceptance_renter.html", "utf8"));

//Defines an email to the renter of gear, sent on the event that the owner denied the booking
bookingDeniedEmail = {
    to: null,
    from: FROM_ADDRESS,
    subject: "Sharingear - your booking got denied",
    text: "Hi,\n\nunfortunately your booking got denied by the owner of the gear.\n\nSearch for other gear https://www.sharingear.com.\n\nHope you have more luck next time,\n\n- Sharingear"
};

bookingRenterReturnedEmailSubject = "End booking and collect your deposit - step 3 of 3";
bookingRenterReturnedEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/end_booking_renter.txt", "utf8"));
bookingRenterReturnedEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/end_booking_renter.html", "utf8"));

receiptRenterEmailSubject = "Sharingear Booking Receipt";
receiptRenterEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/receipt_renter.txt", "utf8"));
receiptRenterEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/receipt_renter.html", "utf8"));


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

send = function(notificationType, notificationParameters, recipientEmail) {
    var emailParams,
        textTemplate,
        htmlTemplate,
        email;
    emailParams = {
        from: FROM_ADDRESS
    };

    switch (notificationType) {
        case OWNER_1_REQUEST:
            emailParams.subject = owner1RequestEmailSubject;
            emailParams.html = owner1RequestEmailHTMLTemplate(notificationParameters);
            emailParams.text = owner1RequestEmailTextTemplate(notificationParameters);
            break;
        case BOOKING_PENDING_RENTER:
            emailParams.subject = bookingPendingRenterEmailSubject;
            emailParams.html = bookingPendingRenterEmailHTMLTemplate(notificationParameters);
            emailParams.text = bookingPendingRenterEmailTextTemplate(notificationParameters);
            break;
        case BOOKING_ACCEPTED_RENTER:
            emailParams.subject = bookingAcceptedRenterEmailSubject;
            emailParams.text = bookingAcceptedRenterEmailTextTemplate(notificationParameters);
            emailParams.html = bookingAcceptedRenterEmailHTMLTemplate(notificationParameters);
            break;
        case OWNER_2_ACCEPT:
            emailParams.subject = owner2AcceptEmailSubject;
            emailParams.html = owner2AcceptEmailHTMLTemplate(notificationParameters);
            emailParams.text = owner2AcceptEmailTextTemplate(notificationParameters);
            break;
        case OWNER_3_PICKUPREMINDER:
            emailParams.subject = owner3PickupReminderEmailSubject;
            emailParams.html = owner3PickupReminderEmailHTMLTemplate;
            emailParams.text = owner3PickupReminderEmailTextTemplate;
            break;
        case OWNER_4_DELIVERYREMINDER:
            emailParams.subject = owner4DeliveryReminderEmailSubject;
            emailParams.html = owner4DeliveryReminderEmailHTMLTemplate;
            emailParams.text = owner4DeliveryReminderEmailTextTemplate;
            break;
        case OWNER_5_END:
            emailParams.subject = owner5EndEmailSubject;
            emailParams.html = owner5EndEmailHTMLTemplate;
            emailParams.text = owner5EndEmailTextTemplate;
            break;
        case OWNER_6_RECEIPT:
            emailParams.subject = owner6ReceiptEmailSubject;
            emailParams.html = owner6ReceiptEmailHTMLTemplate;
            emailParams.text = owner6ReceiptEmailTextTemplate;
            break;
        case BOOKING_DENIED:
            emailParams = bookingDeniedEmail;
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
        case RECEIPT_RENTER:
            emailParams.subject = receiptRenterEmailSubject;
            emailParams.text = receiptRenterEmailTextTemplate(notificationParameters);
            emailParams.html = receiptRenterEmailHTMLTemplate(notificationParameters);
            break;
        default:
            return;
    }
    //Commented because of requere cycle of death

    // User.readUser(recipientID, function(error, recipient) {
    // if(error) {
    // 	console.log("Error retrieving recipient: " + error);
    // 	return;
    // }
    // emailParams.to = recipient.email;
    emailParams.to = recipientEmail;
    textTemplate = _.template(emailParams.text);
    emailParams.text = textTemplate(notificationParameters);
    if (emailParams.html) {
        htmlTemplate = _.template(emailParams.html);
        emailParams.html = htmlTemplate(notificationParameters);
    }
    email = new SendGrid.Email(emailParams);

    SendGrid.send(email, function(error) {
        if (error) {
            console.log("Error sending notification email: " + error);
            return;
        }
    });
    // });
};

module.exports = {
    OWNER_1_REQUEST: OWNER_1_REQUEST,
    OWNER_2_ACCEPT: OWNER_2_ACCEPT,
    OWNER_3_PICKUPREMINDER: OWNER_3_PICKUPREMINDER,
    OWNER_4_DELIVERYREMINDER: OWNER_4_DELIVERYREMINDER,
    OWNER_5_END: OWNER_5_END,
    OWNER_6_RECEIPT: OWNER_6_RECEIPT,

    BOOKING_PENDING_RENTER: BOOKING_PENDING_RENTER,
    BOOKING_ACCEPTED_RENTER: BOOKING_ACCEPTED_RENTER,
    BOOKING_DENIED: BOOKING_DENIED,
    BOOKING_RENTER_RETURNED: BOOKING_RENTER_RETURNED,
    BOOKING_ENDED_OWNER: BOOKING_ENDED_OWNER,
    BOOKING_ENDED_RENTER: BOOKING_ENDED_RENTER,
    RECEIPT_RENTER: RECEIPT_RENTER,

    send: send
};
