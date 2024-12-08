const { Document } = require("@langchain/core/documents");

class AgentboxDocumentCreator {
    static createDocument(entity, type, metadata) {
        const pageContent = this.createText(entity, type);
        return new Document({
            pageContent,
            metadata: {
                ...metadata,
                type,
                source: 'agentbox'
            }
        });
    }

    static createText(entity, type) {
        switch (type) {
            case 'contact':
                return this.createContactText(entity);
            case 'listing':
                return this.createListingText(entity);
            case 'staff':
                return this.createStaffText(entity);
            default:
                throw new Error(`Unknown entity type: ${type}`);
        }
    }

    static createContactText(contact) {
        const parts = [
            `Name: ${[contact.firstName, contact.lastName].filter(Boolean).join(' ')}`,
            contact.jobTitle ? `Job Title: ${contact.jobTitle}` : null,
            contact.companyName ? `Company: ${contact.companyName}` : null,
            contact.email ? `Email: ${contact.email}` : null,
            contact.mobile ? `Mobile: ${contact.mobile}` : null,
            contact.homePhone ? `Home Phone: ${contact.homePhone}` : null,
            contact.workPhone ? `Work Phone: ${contact.workPhone}` : null,
            contact.website ? `Website: ${contact.website}` : null,
            `Status: ${contact.status}`,
            `Type: ${contact.type}`,
            `Source: ${contact.source}`
        ];

        return parts.filter(Boolean).join('\n');
    }

    static createListingText(listing) {
        const parts = [
            `Headline: ${listing.mainHeadline}`,
            `Type: ${listing.type}`,
            `Status: ${listing.status}`,
            `Price: ${listing.displayPrice}`,
            listing.property?.type ? `Property Type: ${listing.property.type}` : null,
            listing.property?.category ? `Category: ${listing.property.category}` : null,
            listing.property?.bedrooms ? `Bedrooms: ${listing.property.bedrooms}` : null,
            listing.property?.bathrooms ? `Bathrooms: ${listing.property.bathrooms}` : null,
            listing.property?.totalParking ? `Parking: ${listing.property.totalParking}` : null,
            listing.property?.address ? `Address: ${[
                listing.property.address.streetAddress,
                listing.property.address.suburb,
                listing.property.address.state,
                listing.property.address.postcode
            ].filter(Boolean).join(', ')}` : null,
            listing.property?.address?.region ? `Region: ${listing.property.address.region}` : null
        ];

        return parts.filter(Boolean).join('\n');
    }

    static createStaffText(staff) {
        const parts = [
            `Name: ${[staff.firstName, staff.lastName].filter(Boolean).join(' ')}`,
            staff.jobTitle ? `Job Title: ${staff.jobTitle}` : null,
            staff.role ? `Role: ${staff.role}` : null,
            staff.email ? `Email: ${staff.email}` : null,
            staff.mobile ? `Mobile: ${staff.mobile}` : null,
            staff.phone ? `Phone: ${staff.phone}` : null,
            staff.officeName ? `Office: ${staff.officeName}` : null,
            `Status: ${staff.status}`
        ];

        return parts.filter(Boolean).join('\n');
    }
}

module.exports = AgentboxDocumentCreator; 