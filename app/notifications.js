/**
 * Sends notifications to users.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var fs = require("fs"),
    _ = require("underscore"),
    SendGrid = require("sendgrid")("sharingear", "Ge4rshar1ng34"),
    db = require("./database"),
    FROM_ADDRESS = "service@sharingear.com",

    OWNER_1_REQUEST = 0,
    owner1RequestEmailSubject,
    owner1RequestEmailHTMLTemplate,
    owner1RequestEmailTextTemplate,
    OWNER_2_ACCEPTANCE = 1,
    owner2AcceptanceEmailSubject,
    owner2AcceptanceEmailHTMLTemplate,
    owner2AcceptanceEmailTextTemplate,
    OWNER_3_START = 2,
    owner3StartEmailSubject,
    owner3StartEmailHTMLTemplate,
    owner3StartEmailTextTemplate,
    OWNER_4_END = 3,
    owner4EndEmailSubject,
    owner4EndEmailHTMLTemplate,
    owner4EndEmailTextTemplate,
    OWNER_5_COMPLETION = 4,
    owner5CompletionEmailSubject,
    owner5CompletionEmailHTMLTemplate,
    owner5CompletionEmailTextTemplate,

    RENTER_1_RESERVATION = 5,
    renter1ReservationEmailSubject,
    renter1ReservationEmailHTMLTemplate,
    renter1ReservationEmailTextTemplate,
    RENTER_2_ACCEPTANCE = 6,
    renter2AcceptanceEmailSubject,
    renter2AcceptanceEmailHTMLTemplate,
    renter2AcceptanceEmailTextTemplate,
    RENTER_3_START = 7,
    renter3StartEmailSubject,
    renter3StartEmailHTMLTemplate,
    renter3StartEmailTextTemplate,
    RENTER_4_END = 8,
    renter4EndEmailSubject,
    renter4EndEmailHTMLTemplate,
    renter4EndEmailTextTemplate,
    RENTER_5_COMPLETION = 9,
    renter5CompletionEmailSubject,
    renter5CompletionEmailHTMLTemplate,
    renter5CompletionEmailTextTemplate,

    OWNER_RECEIPT = 10,
    ownerReceiptEmailSubject,
    ownerReceiptEmailHTMLTemplate,
    ownerReceiptEmailTextTemplate,
    RENTER_RECEIPT = 11,
    renterReceiptEmailSubject,
    renterReceiptEmailHTMLTemplate,
    renterReceiptEmailTextTemplate,

    OWNER_DENIED = 12,
    ownerDeniedEmailSubject,
    ownerDeniedEmailHTMLTemplate,
    ownerDeniedEmailTextTemplate,
    RENTER_DENIED = 13,
    renterDeniedEmailSubject,
    renterDeniedEmailHTMLTemplate,
    renterDeniedEmailTextTemplate,

    readEmailWithID,
    writeEmailWithID,
    send;

_.templateSettings = {
    evaluate: /\{\{=(.+?)\}\}/g,
    interpolate: /\{\{(.+?)\}\}/g,
    escape: /\{\{-(.+?)\}\}/g
};

owner1RequestEmailSubject = "Someone has requested a reservation, response needed – step 1 of 3";
owner1RequestEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_1_request.html", "utf8"));
owner1RequestEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_1_request.txt", "utf8"));

owner2AcceptanceEmailSubject = "You accepted a reservation – step 2 of 3";
owner2AcceptanceEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_2_acceptance.html", "utf8"));
owner2AcceptanceEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_2_acceptance.txt", "utf8"));

owner3StartEmailSubject = "You have a rental coming up";
owner3StartEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_3_start.html", "utf8"));
owner3StartEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_3_start.txt", "utf8"));

owner4EndEmailSubject = "You have a rental ending";
owner4EndEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_4_end.html", "utf8"));
owner4EndEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_4_end.txt", "utf8"));

owner5CompletionEmailSubject = "End booking and get paid - step 3 of 3";
owner5CompletionEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_5_completion.html", "utf8"));
owner5CompletionEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_5_completion.txt", "utf8"));

renter1ReservationEmailSubject = "You have requested a reservation – step 1 of 3 ";
renter1ReservationEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_1_reservation.html", "utf8"));
renter1ReservationEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_1_reservation.txt", "utf8"));

renter2AcceptanceEmailSubject = "Your reservation was accepted – step 2 of 3";
renter2AcceptanceEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_2_acceptance.html", "utf8"));
renter2AcceptanceEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_2_acceptance.txt", "utf8"));

renter3StartEmailSubject = "You have a rental coming up";
renter3StartEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_3_start.html", "utf8"));
renter3StartEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_3_start.txt", "utf8"));

renter4EndEmailSubject = "You have a rental ending";
renter4EndEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_4_end.html", "utf8"));
renter4EndEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_4_end.txt", "utf8"));

renter5CompletionEmailSubject = "End booking - step 3 of 3";
renter5CompletionEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_5_completion.html", "utf8"));
renter5CompletionEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_5_completion.txt", "utf8"));

ownerReceiptEmailSubject = "Sharingear Booking Receipt";
ownerReceiptEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_receipt.html", "utf8"));
ownerReceiptEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_receipt.txt", "utf8"));

renterReceiptEmailSubject = "Sharingear Booking Receipt";
renterReceiptEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_receipt.html", "utf8"));
renterReceiptEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_receipt.txt", "utf8"));

ownerDeniedEmailSubject = "You denied a reservation";
ownerDeniedEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_denied.html", "utf8"));
ownerDeniedEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/owner_denied.txt", "utf8"));

renterDeniedEmailSubject = "Your reservation got denied";
renterDeniedEmailHTMLTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_denied.html", "utf8"));
renterDeniedEmailTextTemplate = _.template(fs.readFileSync(__dirname + "/email_templates/renter_denied.txt", "utf8"));

readEmailWithID = function(emailID, callback) {
    db.query("SELECT email_id FROM emails WHERE email_id=? LIMIT 1", [emailID], function(error, rows) {
        if(error) {
            callback(error);
            return;
        }
        if(rows.length <= 0) {
            callback(null, null);
        }
        else {
            callback(null, rows[0]);
        }
    });
};

writeEmailWithID = function(emailID, callback) {
    db.query("INSERT INTO emails(email_id) VALUES (?);", [emailID], function(error) {
        if(error) {
            callback(error);
            return;
        }
        callback(null);
    });
};

send = function(emailID, notificationType, notificationParameters, recipientEmail) {
    var Notifications = this,
        emailParams,
        textTemplate,
        htmlTemplate;

    this.readEmailWithID(emailID, function(error, email) {
        if (error) {
            console.error("Error reading email with ID " + emailID + ": " + error);
            return;
        }

        if (email !== null) {
            //The email has already been sent
            return;
        }

        Notifications.writeEmailWithID(emailID, function(error) {
            if(error) {
                console.error("Error writing email with ID " + emailID + ": " + error);
                return;
            }

            emailParams = {
                from: FROM_ADDRESS
            };

            switch (notificationType) {
                case OWNER_1_REQUEST:
                    emailParams.subject = owner1RequestEmailSubject;
                    emailParams.html = owner1RequestEmailHTMLTemplate(notificationParameters);
                    emailParams.text = owner1RequestEmailTextTemplate(notificationParameters);
                    break;
                case OWNER_2_ACCEPTANCE:
                    emailParams.subject = owner2AcceptanceEmailSubject;
                    emailParams.html = owner2AcceptanceEmailHTMLTemplate(notificationParameters);
                    emailParams.text = owner2AcceptanceEmailTextTemplate(notificationParameters);
                    break;
                case OWNER_3_START:
                    emailParams.subject = owner3StartEmailSubject;
                    emailParams.html = owner3StartEmailHTMLTemplate;
                    emailParams.text = owner3StartEmailTextTemplate;
                    break;
                case OWNER_4_END:
                    emailParams.subject = owner4EndEmailSubject;
                    emailParams.html = owner4EndEmailHTMLTemplate;
                    emailParams.text = owner4EndEmailTextTemplate;
                    break;
                case OWNER_5_COMPLETION:
                    emailParams.subject = owner5CompletionEmailSubject;
                    emailParams.html = owner5CompletionEmailHTMLTemplate;
                    emailParams.text = owner5CompletionEmailTextTemplate;
                    break;
                case RENTER_1_RESERVATION:
                    emailParams.subject = renter1ReservationEmailSubject;
                    emailParams.html = renter1ReservationEmailHTMLTemplate(notificationParameters);
                    emailParams.text = renter1ReservationEmailTextTemplate(notificationParameters);
                    break;
                case RENTER_2_ACCEPTANCE:
                    emailParams.subject = renter2AcceptanceEmailSubject;
                    emailParams.text = renter2AcceptanceEmailTextTemplate(notificationParameters);
                    emailParams.html = renter2AcceptanceEmailHTMLTemplate(notificationParameters);
                    break;
                case RENTER_3_START:
                    emailParams.subject = renter3StartEmailSubject;
                    emailParams.text = renter3StartEmailHTMLTemplate(notificationParameters);
                    emailParams.html = renter3StartEmailTextTemplate(notificationParameters);
                    break;
                case RENTER_4_END:
                    emailParams.subject = renter4EndEmailSubject;
                    emailParams.text = renter4EndEmailTextTemplate(notificationParameters);
                    emailParams.html = renter4EndEmailHTMLTemplate(notificationParameters);
                    break;
                case RENTER_5_COMPLETION:
                    emailParams.subject = renter5CompletionEmailSubject;
                    emailParams.text = renter5CompletionEmailHTMLTemplate(notificationParameters);
                    emailParams.html = renter5CompletionEmailTextTemplate(notificationParameters);
                    break;
                case OWNER_RECEIPT:
                    emailParams.subject = ownerReceiptEmailSubject;
                    emailParams.html = ownerReceiptEmailHTMLTemplate(notificationParameters);
                    emailParams.text = ownerReceiptEmailTextTemplate(notificationParameters);
                    break;
                case RENTER_RECEIPT:
                    emailParams.subject = renterReceiptEmailSubject;
                    emailParams.html = renterReceiptEmailSubject(notificationParameters);
                    emailParams.text = renterReceiptEmailSubject(notificationParameters);
                    break;
                case OWNER_DENIED:
                    emailParams.subject = ownerDeniedEmailSubject;
                    emailParams.html = ownerDeniedEmailHTMLTemplate(notificationParameters);
                    emailParams.text = ownerDeniedEmailTextTemplate(notificationParameters);
                    break;
                case RENTER_DENIED:
                    emailParams.subject = renterDeniedEmailSubject;
                    emailParams.html = renterDeniedEmailHTMLTemplate(notificationParameters);
                    emailParams.text = renterDeniedEmailTextTemplate(notificationParameters);
                    break;
                default:
                    return;
            }

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
        });
    });
};

module.exports = {
    OWNER_1_REQUEST: OWNER_1_REQUEST,
    OWNER_2_ACCEPTANCE: OWNER_2_ACCEPTANCE,
    OWNER_3_START: OWNER_3_START,
    OWNER_4_END: OWNER_4_END,
    OWNER_5_COMPLETION: OWNER_5_COMPLETION,
    RENTER_1_RESERVATION: RENTER_1_RESERVATION,
    RENTER_2_ACCEPTANCE: RENTER_2_ACCEPTANCE,
    RENTER_3_START: RENTER_3_START,
    RENTER_4_END: RENTER_4_END,
    RENTER_5_COMPLETION: RENTER_5_COMPLETION,
    OWNER_RECEIPT: OWNER_RECEIPT,
    RENTER_RECEIPT: RENTER_RECEIPT,
    OWNER_DENIED: OWNER_DENIED,
    RENTER_DENIED: RENTER_DENIED,

    send: send,
    readEmailWithID: readEmailWithID,
    writeEmailWithID: writeEmailWithID
};
