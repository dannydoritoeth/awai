const { Document } = require("@langchain/core/documents");
const { BaseDocumentCreator } = require('../baseDocumentCreator');

class AgentboxDocumentCreator {
    static createDocument(entity, type, metadata) {
        const pageContent = this.createText(entity, type);
        const enhancedMetadata = this.createEnhancedMetadata(entity, type, metadata);
        return new Document({
            pageContent,
            metadata: enhancedMetadata
        });
    }

    static createEnhancedMetadata(entity, type, baseMetadata) {
        return {
            ...baseMetadata,
            type,
            source: 'agentbox',
            relationships: this._buildRelationships(entity, type),
            metrics: this._calculateMetrics(entity, type),
            history: this._buildHistory(entity)
        };
    }

    static _buildRelationships(entity, type) {
        const relationships = {
            contacts: [],
            listings: [],
            staff: [],
            office: null,
            region: null,
            propertyType: null,
            enquiries: [],
            searchRequirements: []
        };

        switch (type) {
            case 'contact':
                if (entity.office) relationships.office = { id: entity.office.id, type: 'office' };
                if (entity.assignedStaff) relationships.staff.push({ id: entity.assignedStaff.id, type: 'staff' });
                if (entity.viewedListings) relationships.listings = entity.viewedListings.map(l => ({ id: l.id, type: 'listing' }));
                if (entity.enquiries) relationships.enquiries = entity.enquiries.map(e => ({ id: e.id, type: 'enquiry' }));
                if (entity.searchRequirements) relationships.searchRequirements = entity.searchRequirements.map(sr => ({ id: sr.id, type: 'search_requirement' }));
                break;

            case 'listing':
                if (entity.office) relationships.office = { id: entity.office.id, type: 'office' };
                if (entity.listingAgent) relationships.staff.push({ id: entity.listingAgent.id, type: 'staff' });
                if (entity.interestedContacts) relationships.contacts = entity.interestedContacts.map(c => ({ id: c.id, type: 'contact' }));
                if (entity.region) relationships.region = { id: entity.region.id, type: 'region' };
                if (entity.propertyType) relationships.propertyType = { id: entity.propertyType.id, type: 'property_type' };
                if (entity.enquiries) relationships.enquiries = entity.enquiries.map(e => ({ id: e.id, type: 'enquiry' }));
                break;

            case 'staff':
                if (entity.office) relationships.office = { id: entity.office.id, type: 'office' };
                if (entity.team) relationships.staff = entity.team.map(s => ({ id: s.id, type: 'staff' }));
                if (entity.listings) relationships.listings = entity.listings.map(l => ({ id: l.id, type: 'listing' }));
                if (entity.contacts) relationships.contacts = entity.contacts.map(c => ({ id: c.id, type: 'contact' }));
                if (entity.enquiries) relationships.enquiries = entity.enquiries.map(e => ({ id: e.id, type: 'enquiry' }));
                break;
        }

        return relationships;
    }

    static _calculateMetrics(entity, type) {
        return {
            engagementScore: this._calculateEngagementScore(entity, type),
            activityLevel: this._calculateActivityLevel(entity, type),
            marketRelevance: this._calculateMarketRelevance(entity, type),
            lastActivity: entity.lastModified || entity.lastActivity,
            totalInteractions: this._countInteractions(entity, type)
        };
    }

    static _buildHistory(entity) {
        return {
            statusChanges: entity.statusHistory || [],
            interactions: entity.interactions || [],
            modifications: entity.modifications || [],
            created: entity.firstCreated,
            modified: entity.lastModified
        };
    }

    static _calculateEngagementScore(entity, type) {
        let score = 0;
        switch (type) {
            case 'contact':
                if (entity.enquiries) score += entity.enquiries.length * 10;
                if (entity.viewedListings) score += entity.viewedListings.length * 5;
                if (entity.searchRequirements) score += entity.searchRequirements.length * 3;
                break;
            case 'listing':
                if (entity.enquiries) score += entity.enquiries.length * 10;
                if (entity.interestedContacts) score += entity.interestedContacts.length * 5;
                if (entity.openHomes) score += entity.openHomes.length * 3;
                break;
            case 'staff':
                if (entity.listings) score += entity.listings.length * 5;
                if (entity.contacts) score += entity.contacts.length * 3;
                if (entity.enquiries) score += entity.enquiries.length * 2;
                break;
        }
        return score;
    }

    static _calculateActivityLevel(entity, type) {
        const now = new Date();
        const lastActivity = new Date(entity.lastModified || entity.lastActivity);
        const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

        if (daysSinceActivity < 7) return 'high';
        if (daysSinceActivity < 30) return 'medium';
        return 'low';
    }

    static _calculateMarketRelevance(entity, type) {
        let relevance = 'medium';
        switch (type) {
            case 'contact':
                if (entity.interestLevel === 'Hot') relevance = 'high';
                if (entity.searchRequirements?.length > 0) relevance = 'high';
                break;
            case 'listing':
                if (entity.status === 'Active' && entity.enquiries?.length > 0) relevance = 'high';
                break;
            case 'staff':
                if (entity.listings?.some(l => l.status === 'Active')) relevance = 'high';
                break;
        }
        return relevance;
    }

    static _countInteractions(entity, type) {
        let count = 0;
        if (entity.enquiries) count += entity.enquiries.length;
        if (entity.interactions) count += entity.interactions.length;
        if (entity.modifications) count += entity.modifications.length;
        return count;
    }

    static createText(entity, type) {
        switch (type) {
            case 'contact':
                return this.createContactText(entity);
            case 'listing':
                return this.createListingText(entity);
            case 'staff':
                return this.createStaffText(entity);
            case 'interest_level':
                return this.createInterestLevelText(entity);
            case 'property_type':
                return this.createPropertyTypeText(entity);
            case 'region':
                return this.createRegionText(entity);
            case 'enquiry_source':
                return this.createEnquirySourceText(entity);
            case 'contact_class':
                return this.createContactClassText(entity);
            case 'contact_source':
                return this.createContactSourceText(entity);
            case 'office':
                return this.createOfficeText(entity);
            case 'enquiry_type':
                return this.createEnquiryTypeText(entity);
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
            `Source: ${contact.source}`,
            '',
            'Relationships:',
            `Contact Class: ${this._formatContactClass(contact.class)}`,
            `Source: ${this._formatContactSource(contact.source)}`,
            `Primary Office: ${this._formatOffice(contact.office)}`,
            `Assigned Staff: ${this._formatStaff(contact.assignedStaff)}`,
            '',
            'Engagement History:',
            `Interest Level: ${this._formatInterestLevel(contact.interestLevel)}`,
            `Recent Enquiries: ${this._summarizeEnquiries(contact.enquiries)}`,
            `Property Preferences: ${this._summarizeSearchRequirements(contact.searchRequirements)}`,
            '',
            'Market Activity:',
            `Viewed Listings: ${this._summarizeViewedListings(contact.viewedListings)}`,
            `Favorite Regions: ${this._summarizeRegions(contact.regions)}`,
            `Preferred Property Types: ${this._summarizePropertyTypes(contact.propertyTypes)}`
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
            listing.property?.address?.region ? `Region: ${listing.property.address.region}` : null,
            '',
            'Property Details:',
            `Property Type: ${this._formatPropertyType(listing.propertyType)}`,
            `Region: ${this._formatRegion(listing.region)}`,
            `Office: ${this._formatOffice(listing.office)}`,
            '',
            'Market Activity:',
            `Enquiry Count: ${this._summarizeEnquiries(listing.enquiries)}`,
            `Interested Contacts: ${this._summarizeInterestedContacts(listing.interestedContacts)}`,
            `Similar Listings: ${this._summarizeSimilarListings(listing.similarListings)}`,
            '',
            'Sales Process:',
            `Listing Agent: ${this._formatStaff(listing.listingAgent)}`,
            `Open Home History: ${this._summarizeOpenHomes(listing.openHomes)}`,
            `Price History: ${this._summarizePriceHistory(listing.priceHistory)}`
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
            `Status: ${staff.status}`,
            '',
            'Work Context:',
            `Office: ${this._formatOffice(staff.office)}`,
            `Team Members: ${this._summarizeTeamMembers(staff.team)}`,
            '',
            'Performance Metrics:',
            `Active Listings: ${this._summarizeActiveListings(staff.listings)}`,
            `Contact Portfolio: ${this._summarizeContactPortfolio(staff.contacts)}`,
            `Recent Enquiries: ${this._summarizeEnquiries(staff.enquiries)}`,
            '',
            'Territory Coverage:',
            `Primary Regions: ${this._summarizeRegions(staff.regions)}`,
            `Property Types: ${this._summarizePropertyTypes(staff.propertyTypes)}`
        ];

        return parts.filter(Boolean).join('\n');
    }

    static createInterestLevelText(interestLevel) {
        const parts = [
            `Interest Level: ${interestLevel.name}`,
            `ID: ${interestLevel.id}`,
            `Description: This represents a ${interestLevel.name.toLowerCase()} level of interest from a potential buyer or enquirer.`,
            `Usage: Used for categorizing and scoring leads based on their engagement and likelihood to convert.`
        ];

        return parts.filter(Boolean).join('\n');
    }

    static createPropertyTypeText(propertyType) {
        const typeDescriptions = {
            'Residential': 'Properties designed for living purposes, including houses, apartments, and units.',
            'Commercial': 'Properties used for business purposes, including offices, retail spaces, and industrial buildings.',
            'Rural': 'Properties in rural areas, including farms, ranches, and agricultural land.',
            'Business': 'Properties with established businesses or suitable for business operations.',
            'Holiday': 'Properties designed for vacation and short-term stays.'
        };

        const parts = [
            `Property Type: ${propertyType.type}`,
            `ID: ${propertyType.id}`,
            `Description: ${typeDescriptions[propertyType.type] || `Properties classified as ${propertyType.type.toLowerCase()}`}`,
            'Market Characteristics:',
            `- Primary Use: ${propertyType.type.toLowerCase()} purposes`,
            `- Target Market: ${this._getTargetMarket(propertyType.type)}`,
            `- Investment Profile: ${this._getInvestmentProfile(propertyType.type)}`
        ];

        return parts.filter(Boolean).join('\n');
    }

    static _getTargetMarket(type) {
        const targetMarkets = {
            'Residential': 'Home buyers, families, and residential property investors',
            'Commercial': 'Business owners, commercial investors, and property developers',
            'Rural': 'Farmers, agricultural businesses, and lifestyle property seekers',
            'Business': 'Entrepreneurs, business owners, and commercial operators',
            'Holiday': 'Vacation home buyers, tourism operators, and lifestyle investors'
        };
        return targetMarkets[type] || 'General property buyers and investors';
    }

    static _getInvestmentProfile(type) {
        const profiles = {
            'Residential': 'Stable long-term growth with rental income potential',
            'Commercial': 'Higher yields with longer lease terms and business tenants',
            'Rural': 'Land value appreciation with agricultural or development potential',
            'Business': 'Combined property and business investment opportunity',
            'Holiday': 'Seasonal rental income with lifestyle benefits'
        };
        return profiles[type] || 'Standard property investment characteristics';
    }

    static createRegionText(region) {
        const stateDescriptions = {
            'NSW': 'New South Wales',
            'VIC': 'Victoria',
            'QLD': 'Queensland',
            'SA': 'South Australia',
            'WA': 'Western Australia',
            'TAS': 'Tasmania',
            'NT': 'Northern Territory',
            'ACT': 'Australian Capital Territory'
        };

        const parts = [
            `Region: ${region.name}`,
            `Regional Group: ${region.group}`,
            `State: ${stateDescriptions[region.state] || region.state}`,
            `Country: ${region.country}`,
            '',
            'Market Information:',
            `- Location: ${this._getRegionDescription(region)}`,
            `- Market Type: ${this._getMarketType(region)}`,
            `- Key Features: ${this._getRegionFeatures(region)}`
        ];

        return parts.filter(Boolean).join('\n');
    }

    static _getRegionDescription(region) {
        if (region.group === 'Sydney Region') {
            return `Part of the greater Sydney metropolitan area in ${stateDescriptions[region.state]}, ${region.country}`;
        }
        return `Located in ${region.state}, ${region.country}`;
    }

    static _getMarketType(region) {
        const marketTypes = {
            'Blue Mountains & Surrounds': 'Lifestyle and tourism-focused market with mix of permanent residents and holiday properties',
            'North Shore - Upper': 'Premium residential market with established family homes and prestigious schools',
            'Canterbury/Bankstown': 'Diverse multicultural area with mix of residential and commercial properties',
            'Northern Beaches': 'Coastal lifestyle market with premium beachside properties',
            'Eastern Suburbs': 'High-end residential market with luxury properties and strong amenity',
            'Northern Suburbs': 'Family-oriented residential market with good transport links',
            'Hawkesbury': 'Semi-rural market with mix of residential and agricultural properties',
            'Parramatta': 'Major commercial hub with growing residential development',
            'Hills': 'Premium family market with larger blocks and newer developments',
            'St George': 'Established residential area with good transport connections'
        };
        return marketTypes[region.name] || 'Mixed residential and commercial market';
    }

    static _getRegionFeatures(region) {
        const features = {
            'Blue Mountains & Surrounds': 'Natural beauty, tourism, lifestyle properties',
            'North Shore - Upper': 'Premium schools, leafy streets, established homes',
            'Canterbury/Bankstown': 'Cultural diversity, affordability, transport links',
            'Northern Beaches': 'Coastal lifestyle, beaches, outdoor recreation',
            'Eastern Suburbs': 'Beaches, entertainment, premium amenities',
            'Northern Suburbs': 'Family friendly, parks, good schools',
            'Hawkesbury': 'Rural lifestyle, heritage, river access',
            'Parramatta': 'Business district, shopping, transport hub',
            'Hills': 'Family lifestyle, space, modern amenities',
            'St George': 'Community focus, transport, local shopping'
        };
        return features[region.name] || 'Mixed residential and commercial features';
    }

    static createEnquirySourceText(source) {
        const sourceDescriptions = {
            'Database': 'Internal database of existing contacts and leads',
            'Domain.com.au': 'Major Australian real estate portal with national reach',
            'Letterbox Drop': 'Direct mail marketing to specific geographic areas',
            'Newspaper': 'Traditional print media advertising',
            'Open House': 'Property inspection events open to the public',
            'Realestate.com.au': 'Australia\'s largest property marketplace',
            'Signboard': 'Physical property signage and display boards',
            'Website': 'Company website and online presence',
            'Word Of Mouth': 'Referrals and recommendations from existing clients',
            'Phone Enquiry': 'Direct phone inquiries to the agency',
            'Flow': 'Automated marketing and lead nurture system',
            'Landing Page': 'Targeted web pages for specific campaigns'
        };

        const channelTypes = {
            'Database': 'Internal',
            'Domain.com.au': 'Online Portal',
            'Letterbox Drop': 'Direct Marketing',
            'Newspaper': 'Traditional Media',
            'Open House': 'Event',
            'Realestate.com.au': 'Online Portal',
            'Signboard': 'Physical Marketing',
            'Website': 'Digital',
            'Word Of Mouth': 'Referral',
            'Phone Enquiry': 'Direct Contact',
            'Flow': 'Digital',
            'Landing Page': 'Digital'
        };

        const parts = [
            `Source: ${source.name}`,
            `Channel Type: ${channelTypes[source.name] || 'Other'}`,
            `Description: ${sourceDescriptions[source.name] || 'Custom enquiry source'}`,
            '',
            'Channel Characteristics:',
            `- Type: ${this._getChannelType(source.name)}`,
            `- Typical Usage: ${this._getChannelUsage(source.name)}`,
            `- Key Benefits: ${this._getChannelBenefits(source.name)}`
        ];

        return parts.filter(Boolean).join('\n');
    }

    static _getChannelType(sourceName) {
        const types = {
            'Database': 'Internal data-driven channel for existing contact engagement',
            'Domain.com.au': 'Major online property portal with national reach',
            'Letterbox Drop': 'Traditional direct mail marketing channel',
            'Newspaper': 'Print media advertising channel',
            'Open House': 'In-person property viewing event',
            'Realestate.com.au': 'Premier online property marketplace',
            'Signboard': 'Physical on-site property marketing',
            'Website': 'Digital owned media channel',
            'Word Of Mouth': 'Organic referral network',
            'Phone Enquiry': 'Direct communication channel',
            'Flow': 'Automated digital marketing system',
            'Landing Page': 'Targeted digital campaign page'
        };
        return types[sourceName] || 'Custom marketing channel';
    }

    static _getChannelUsage(sourceName) {
        const usage = {
            'Database': 'Lead nurturing and repeat business generation',
            'Domain.com.au': 'Broad market reach and qualified lead generation',
            'Letterbox Drop': 'Local area marketing and community engagement',
            'Newspaper': 'Traditional brand awareness and property promotion',
            'Open House': 'Direct property showcasing and buyer engagement',
            'Realestate.com.au': 'Maximum exposure to active property seekers',
            'Signboard': 'Local area awareness and property identification',
            'Website': 'Brand presence and direct enquiry generation',
            'Word Of Mouth': 'Trust-based referrals and recommendations',
            'Phone Enquiry': 'Immediate response to property interest',
            'Flow': 'Automated lead nurturing and engagement',
            'Landing Page': 'Campaign-specific lead capture'
        };
        return usage[sourceName] || 'General enquiry generation';
    }

    static _getChannelBenefits(sourceName) {
        const benefits = {
            'Database': 'High conversion rate, low cost, targeted communication',
            'Domain.com.au': 'Wide reach, qualified leads, strong brand presence',
            'Letterbox Drop': 'Geographic targeting, local presence, tangible marketing',
            'Newspaper': 'Traditional audience reach, brand credibility, local focus',
            'Open House': 'Direct buyer interaction, immediate feedback, multiple viewings',
            'Realestate.com.au': 'Highest visibility, serious buyers, detailed analytics',
            'Signboard': 'Local awareness, 24/7 visibility, brand reinforcement',
            'Website': 'Brand control, cost-effective, detailed information',
            'Word Of Mouth': 'High trust, quality leads, strong relationships',
            'Phone Enquiry': 'Immediate engagement, personal connection, quick response',
            'Flow': 'Automated engagement, consistent follow-up, scalable process',
            'Landing Page': 'Focused messaging, trackable results, campaign optimization'
        };
        return benefits[sourceName] || 'Diversified lead generation';
    }

    static createContactClassText(contactClass) {
        const classDescriptions = {
            'Buyer': 'Active property purchaser seeking to acquire real estate',
            'Vendor': 'Property owner looking to sell their real estate',
            'Solicitor': 'Legal professional handling property transactions',
            'Developer': 'Professional involved in property development projects',
            'Accountant': 'Financial professional providing property-related services',
            'Tenant': 'Individual or entity renting a property',
            'Landlord': 'Property owner leasing their real estate',
            'Investor': 'Individual or entity investing in property for returns',
            'Owner Occupier': 'Property owner living in their own property',
            'Referrer': 'Individual or entity providing business referrals',
            'Tradesperson': 'Professional providing property maintenance services',
            'Supplier': 'Provider of property-related products or services',
            'Conjunctional Agent': 'Partner agent collaborating on property deals',
            'Buyer Solicitor': 'Legal representative for property buyers',
            'Vendor Solicitor': 'Legal representative for property sellers',
            'Auctioneer': 'Professional conducting property auctions',
            'Business': 'Commercial entity involved in property transactions',
            'Prospective Vendor': 'Potential property seller considering listing',
            'Prospective Buyer': 'Potential property purchaser exploring options',
            'Prospective Landlord': 'Potential property owner considering leasing'
        };

        const parts = [
            `Contact Class: ${contactClass.displayName}`,
            `Type: ${contactClass.type}`,
            `Description: ${classDescriptions[contactClass.name] || 'Standard contact classification'}`,
            '',
            'Role Characteristics:',
            `- Primary Function: ${this._getPrimaryFunction(contactClass.name)}`,
            `- Typical Interactions: ${this._getTypicalInteractions(contactClass.name)}`,
            `- Engagement Strategy: ${this._getEngagementStrategy(contactClass.name)}`
        ];

        return parts.filter(Boolean).join('\n');
    }

    static _getPrimaryFunction(className) {
        const functions = {
            'Buyer': 'Property acquisition and purchase negotiations',
            'Vendor': 'Property sale and marketing coordination',
            'Solicitor': 'Legal documentation and transaction support',
            'Developer': 'Property development and project management',
            'Accountant': 'Financial advice and transaction support',
            'Tenant': 'Property rental and occupancy',
            'Landlord': 'Property leasing and management',
            'Investor': 'Property investment and portfolio management',
            'Owner Occupier': 'Property ownership and residence',
            'Referrer': 'Business referral and networking',
            'Tradesperson': 'Property maintenance and improvements',
            'Supplier': 'Product and service provision',
            'Conjunctional Agent': 'Collaborative property sales',
            'Buyer Solicitor': 'Buyer legal representation',
            'Vendor Solicitor': 'Vendor legal representation',
            'Auctioneer': 'Auction management and execution',
            'Business': 'Commercial property transactions',
            'Prospective Vendor': 'Property sale consideration',
            'Prospective Buyer': 'Property purchase consideration',
            'Prospective Landlord': 'Property leasing consideration'
        };
        return functions[className] || 'General property market participation';
    }

    static _getTypicalInteractions(className) {
        const interactions = {
            'Buyer': 'Property viewings, negotiations, purchase process',
            'Vendor': 'Property listing, marketing approval, sale negotiations',
            'Solicitor': 'Contract review, settlement coordination, legal advice',
            'Developer': 'Project planning, construction coordination, sales strategy',
            'Accountant': 'Financial planning, tax advice, transaction support',
            'Tenant': 'Property viewings, lease agreements, maintenance requests',
            'Landlord': 'Property management, tenant selection, maintenance approval',
            'Investor': 'Market analysis, portfolio review, investment strategy',
            'Owner Occupier': 'Property maintenance, community engagement',
            'Referrer': 'Lead generation, network building, relationship management',
            'Tradesperson': 'Maintenance quotes, repair work, property improvements',
            'Supplier': 'Product supply, service delivery, account management',
            'Conjunctional Agent': 'Deal collaboration, commission sharing, joint marketing',
            'Buyer Solicitor': 'Purchase contracts, due diligence, buyer advocacy',
            'Vendor Solicitor': 'Sale contracts, vendor advocacy, settlement coordination',
            'Auctioneer': 'Auction preparation, bidding management, sale completion',
            'Business': 'Commercial negotiations, lease arrangements, property transactions',
            'Prospective Vendor': 'Market appraisals, selling advice, timing discussions',
            'Prospective Buyer': 'Property requirements, market education, viewing arrangements',
            'Prospective Landlord': 'Investment advice, market updates, management options'
        };
        return interactions[className] || 'Standard property-related interactions';
    }

    static _getEngagementStrategy(className) {
        const strategies = {
            'Buyer': 'Regular property matches, market updates, viewing coordination',
            'Vendor': 'Marketing updates, feedback reports, price discussions',
            'Solicitor': 'Transaction updates, document coordination, timeline management',
            'Developer': 'Project updates, market insights, sales coordination',
            'Accountant': 'Financial updates, transaction coordination, tax planning',
            'Tenant': 'Property maintenance, lease renewals, payment management',
            'Landlord': 'Property reports, tenant updates, maintenance coordination',
            'Investor': 'Investment opportunities, market analysis, portfolio reviews',
            'Owner Occupier': 'Property maintenance, community updates, market value tracking',
            'Referrer': 'Regular contact, success sharing, relationship building',
            'Tradesperson': 'Work coordination, quality assurance, ongoing relationship',
            'Supplier': 'Regular ordering, service scheduling, account reviews',
            'Conjunctional Agent': 'Deal sharing, commission arrangements, collaborative marketing',
            'Buyer Solicitor': 'Purchase coordination, timeline management, documentation',
            'Vendor Solicitor': 'Sale coordination, settlement management, documentation',
            'Auctioneer': 'Auction planning, marketing coordination, results reporting',
            'Business': 'Commercial opportunities, market updates, transaction management',
            'Prospective Vendor': 'Market updates, timing advice, preparation guidance',
            'Prospective Buyer': 'Property matches, market education, viewing arrangements',
            'Prospective Landlord': 'Investment advice, market updates, management options'
        };
        return strategies[className] || 'Customized engagement based on needs and preferences';
    }

    static createContactSourceText(source) {
        const sourceDescriptions = {
            'Phone Enquiry': 'Direct telephone contact initiated by potential clients',
            'Email Enquiry': 'Email-based communication from interested parties',
            'Website Enquiry': 'Inquiries submitted through the agency website',
            'Auto Email': 'Automated email-based lead generation',
            'Import': 'Contacts imported from external systems or databases',
            'Other': 'Miscellaneous contact acquisition methods',
            'Open Homes Inspection': 'Contacts gathered during property viewings',
            'Doorknocking': 'Direct community engagement through door-to-door contact',
            'API': 'Contacts acquired through system integrations',
            'Sandbox': 'Test contacts for system validation',
            'Magnifi - Agent lead form': 'Leads generated through Magnifi agent forms'
        };

        const parts = [
            `Source: ${source.name}`,
            `Description: ${sourceDescriptions[source.name] || 'Custom contact acquisition channel'}`,
            '',
            'Channel Characteristics:',
            `- Type: ${this._getSourceType(source.name)}`,
            `- Engagement Model: ${this._getEngagementModel(source.name)}`,
            `- Lead Quality Indicators: ${this._getQualityIndicators(source.name)}`,
            `- Follow-up Strategy: ${this._getFollowUpStrategy(source.name)}`
        ];

        return parts.filter(Boolean).join('\n');
    }

    static _getSourceType(sourceName) {
        const types = {
            'Phone Enquiry': 'Direct communication channel with immediate interaction',
            'Email Enquiry': 'Digital communication channel with asynchronous interaction',
            'Website Enquiry': 'Online form submission with structured data collection',
            'Auto Email': 'Automated digital communication channel',
            'Import': 'Bulk data acquisition channel',
            'Other': 'Alternative contact acquisition methods',
            'Open Homes Inspection': 'In-person engagement channel',
            'Doorknocking': 'Direct outreach channel',
            'API': 'Technical integration channel',
            'Sandbox': 'Testing and validation channel',
            'Magnifi - Agent lead form': 'Agent-specific digital lead capture'
        };
        return types[sourceName] || 'Custom acquisition channel';
    }

    static _getEngagementModel(sourceName) {
        const models = {
            'Phone Enquiry': 'Real-time conversation with immediate response capability',
            'Email Enquiry': 'Response-driven engagement with documentation trail',
            'Website Enquiry': 'Form-based interaction with automated processing',
            'Auto Email': 'Automated engagement sequence with tracking',
            'Import': 'Batch processing with targeted follow-up',
            'Other': 'Varied engagement based on source specifics',
            'Open Homes Inspection': 'Face-to-face interaction with property context',
            'Doorknocking': 'Personal interaction in client environment',
            'API': 'System-driven engagement with automation',
            'Sandbox': 'Test environment engagement simulation',
            'Magnifi - Agent lead form': 'Agent-mediated digital engagement'
        };
        return models[sourceName] || 'Standard engagement process';
    }

    static _getQualityIndicators(sourceName) {
        const indicators = {
            'Phone Enquiry': 'High intent, immediate interest, direct communication',
            'Email Enquiry': 'Specific interest, documented requirements, follow-up potential',
            'Website Enquiry': 'Digital engagement, self-qualified, trackable interest',
            'Auto Email': 'Automated qualification, behavior tracking, engagement metrics',
            'Import': 'Historical data, pre-qualified status, bulk processing',
            'Other': 'Variable quality based on source specifics',
            'Open Homes Inspection': 'High intent, property-specific interest, in-person validation',
            'Doorknocking': 'Local market interest, direct qualification, relationship building',
            'API': 'System-validated data, integration quality, automated verification',
            'Sandbox': 'Test data quality metrics',
            'Magnifi - Agent lead form': 'Agent-qualified leads, structured data capture'
        };
        return indicators[sourceName] || 'Standard quality assessment metrics';
    }

    static _getFollowUpStrategy(sourceName) {
        const strategies = {
            'Phone Enquiry': 'Immediate response, detailed requirements gathering, personalized follow-up',
            'Email Enquiry': 'Prompt response, information package, scheduled follow-up',
            'Website Enquiry': 'Automated confirmation, personalized response, systematic follow-up',
            'Auto Email': 'Automated sequence, engagement tracking, triggered follow-up',
            'Import': 'Segmented outreach, targeted campaigns, systematic engagement',
            'Other': 'Customized follow-up based on source characteristics',
            'Open Homes Inspection': 'Same-day follow-up, property-specific feedback, next steps',
            'Doorknocking': 'Relationship building, local market updates, community engagement',
            'API': 'Automated workflow, system-triggered actions, integrated follow-up',
            'Sandbox': 'Test follow-up process validation',
            'Magnifi - Agent lead form': 'Agent-driven follow-up, structured process, tracked engagement'
        };
        return strategies[sourceName] || 'Standard follow-up process';
    }

    static createOfficeText(office) {
        const parts = [
            `Office: ${office.name}`,
            `Status: ${office.status}`,
            office.companyName ? `Company: ${office.companyName}` : null,
            office.tradingName ? `Trading As: ${office.tradingName}` : null,
            '',
            'Location Information:',
            this._formatAddress(office.address),
            office.location ? `Coordinates: ${office.location.lat}, ${office.location.long}` : null,
            '',
            'Contact Details:',
            office.phone ? `Phone: ${office.phone}` : null,
            office.email ? `Email: ${office.email}` : null,
            office.website ? `Website: ${office.website}` : null,
            '',
            'Business Information:',
            `- Market Coverage: ${this._getMarketCoverage(office)}`,
            `- Service Area: ${this._getServiceArea(office)}`,
            `- Office Type: ${this._getOfficeType(office)}`,
            '',
            'Operational Details:',
            `- Business Focus: ${this._getBusinessFocus(office)}`,
            `- Market Position: ${this._getMarketPosition(office)}`,
            `- Coverage Strategy: ${this._getCoverageStrategy(office)}`
        ];

        return parts.filter(Boolean).join('\n');
    }

    static _formatAddress(address) {
        if (!address) return null;
        const parts = [
            address.streetAddress,
            address.suburb,
            address.state,
            address.postcode,
            address.country
        ].filter(Boolean);
        return `Address: ${parts.join(', ')}`;
    }

    static _getMarketCoverage(office) {
        if (office.name.includes('Eveleigh')) {
            return 'Inner city technology precinct with mixed residential and commercial properties';
        } else if (office.name.includes('Newtown')) {
            return 'Inner west urban area with diverse property portfolio';
        }
        return 'Mixed metropolitan area with diverse property types';
    }

    static _getServiceArea(office) {
        const suburbs = {
            'Eveleigh': ['Eveleigh', 'Redfern', 'Waterloo', 'Alexandria', 'Erskineville'],
            'Newtown': ['Newtown', 'Enmore', 'Stanmore', 'Camperdown', 'Erskineville']
        };

        for (const [key, value] of Object.entries(suburbs)) {
            if (office.name.includes(key)) {
                return `Primary coverage: ${value.join(', ')}`;
            }
        }
        return 'Metropolitan area coverage';
    }

    static _getOfficeType(office) {
        if (office.franchiseGroup) {
            return `Franchise office - ${office.franchiseGroup}`;
        } else if (office.companyName) {
            return 'Independent office with corporate structure';
        }
        return 'Independent real estate office';
    }

    static _getBusinessFocus(office) {
        const focuses = {
            'Eveleigh': 'Technology precinct properties, urban renewal developments, commercial leasing',
            'Newtown': 'Inner west residential, heritage properties, creative spaces',
            'default': 'Full-service real estate operations including sales, leasing, and property management'
        };

        for (const [key, value] of Object.entries(focuses)) {
            if (office.name.includes(key)) {
                return value;
            }
        }
        return focuses.default;
    }

    static _getMarketPosition(office) {
        const positions = {
            'Eveleigh': 'Leading technology precinct specialist with strong commercial focus',
            'Newtown': 'Inner west lifestyle property expert with heritage expertise',
            'default': 'Full-service real estate agency with comprehensive market coverage'
        };

        for (const [key, value] of Object.entries(positions)) {
            if (office.name.includes(key)) {
                return value;
            }
        }
        return positions.default;
    }

    static _getCoverageStrategy(office) {
        const strategies = {
            'Eveleigh': 'Focus on technology precinct and surrounding urban renewal areas',
            'Newtown': 'Specialized in inner west character properties and local community',
            'default': 'Comprehensive coverage of metropolitan property market'
        };

        for (const [key, value] of Object.entries(strategies)) {
            if (office.name.includes(key)) {
                return value;
            }
        }
        return strategies.default;
    }

    static createEnquiryTypeText(type) {
        const typeDescriptions = {
            'General Enquiry': 'General information requests and non-specific enquiries',
            'Buyer Enquiry': 'Property purchase and viewing requests from potential buyers',
            'Vendor Enquiry': 'Property listing and selling requests from potential vendors',
            'Tenant Enquiry': 'Rental and leasing requests from potential tenants',
            'Complaint': 'Issues, concerns, and formal complaints requiring attention',
            'Contract': 'Contract-related enquiries and documentation requests',
            'Other': 'Miscellaneous enquiries not fitting standard categories'
        };

        const priorities = {
            'General Enquiry': 'Standard priority with normal response time',
            'Buyer Enquiry': 'High priority requiring prompt attention',
            'Vendor Enquiry': 'High priority with business development focus',
            'Tenant Enquiry': 'Medium priority with rental focus',
            'Complaint': 'Urgent priority requiring immediate attention',
            'Contract': 'High priority with legal/compliance focus',
            'Other': 'Variable priority based on content'
        };

        const requirements = {
            'General Enquiry': 'Standard information package and follow-up',
            'Buyer Enquiry': 'Property details, inspection arrangements, price information',
            'Vendor Enquiry': 'Market analysis, appraisal scheduling, listing process',
            'Tenant Enquiry': 'Property availability, inspection times, application process',
            'Complaint': 'Acknowledgment, investigation, resolution plan',
            'Contract': 'Document preparation, legal review, timeline coordination',
            'Other': 'Custom response based on enquiry content'
        };

        const timelines = {
            'General Enquiry': '24-48 hours for initial response',
            'Buyer Enquiry': 'Same day response with 24-hour follow-up',
            'Vendor Enquiry': 'Same day response with appraisal within 48 hours',
            'Tenant Enquiry': '24-hour response with inspection scheduling',
            'Complaint': 'Immediate acknowledgment, 48-hour resolution plan',
            'Contract': 'Same day review, 48-hour processing',
            'Other': 'Response within 48 hours'
        };

        const parts = [
            `Enquiry Type: ${type.name}`,
            `Description: ${typeDescriptions[type.name] || 'Standard enquiry classification'}`,
            '',
            'Handling Characteristics:',
            `- Priority Level: ${priorities[type.name] || 'Standard priority level'}`,
            `- Response Requirements: ${requirements[type.name] || 'Standard response protocol'}`,
            `- Typical Timeline: ${timelines[type.name] || 'Standard response timeline'}`
        ];

        return parts.filter(Boolean).join('\n');
    }

    // Helper methods for formatting and summarizing relationships
    static _formatContactClass(contactClass) {
        return contactClass ? `${contactClass.name} (${contactClass.type})` : 'Not specified';
    }

    static _formatContactSource(source) {
        return source ? `${source.name}` : 'Not specified';
    }

    static _formatOffice(office) {
        return office ? `${office.name} (${office.suburb})` : 'Not specified';
    }

    static _formatStaff(staff) {
        return staff ? `${staff.firstName} ${staff.lastName} (${staff.role})` : 'Not assigned';
    }

    static _formatInterestLevel(level) {
        return level ? `${level.name}` : 'Not specified';
    }

    static _summarizeEnquiries(enquiries) {
        if (!enquiries?.length) return 'No recent enquiries';
        return `${enquiries.length} enquiries (Last: ${new Date(enquiries[0].date).toLocaleDateString()})`;
    }

    static _summarizeSearchRequirements(requirements) {
        if (!requirements?.length) return 'No specific requirements';
        return requirements.map(r => r.description).join(', ');
    }

    static _summarizeViewedListings(listings) {
        if (!listings?.length) return 'No viewed listings';
        return `${listings.length} listings viewed`;
    }

    static _summarizeRegions(regions) {
        if (!regions?.length) return 'No specific regions';
        return regions.map(r => r.name).join(', ');
    }

    static _summarizePropertyTypes(types) {
        if (!types?.length) return 'No specific types';
        return types.map(t => t.name).join(', ');
    }

    static _summarizeTeamMembers(team) {
        if (!team?.length) return 'No team members';
        return `${team.length} team members`;
    }

    static _summarizeActiveListings(listings) {
        if (!listings?.length) return 'No active listings';
        const active = listings.filter(l => l.status === 'Active');
        return `${active.length} active out of ${listings.length} total`;
    }

    static _summarizeContactPortfolio(contacts) {
        if (!contacts?.length) return 'No contacts';
        return `${contacts.length} contacts managed`;
    }

    static _summarizeOpenHomes(openHomes) {
        if (!openHomes?.length) return 'No open homes scheduled';
        return `${openHomes.length} open homes held`;
    }

    static _summarizePriceHistory(history) {
        if (!history?.length) return 'No price changes';
        return `${history.length} price updates`;
    }

    static _summarizeInterestedContacts(contacts) {
        if (!contacts?.length) return 'No interested contacts';
        return `${contacts.length} interested contacts`;
    }

    static _summarizeSimilarListings(listings) {
        if (!listings?.length) return 'No similar listings';
        return `${listings.length} similar properties`;
    }
}

class EnquiryDocumentCreator extends BaseDocumentCreator {
    constructor() {
        super('enquiry');
    }

    async createDocuments(records) {
        return records.map(record => {
            const metadata = {
                id: record.id,
                type: record.type,
                origin: record.origin,
                enquiryDate: record.date,
                createdDate: record.firstCreated,
                modifiedDate: record.lastModified,
                entityType: 'enquiry'
            };

            // Analyze enquiry intent and categorize
            const intent = this._analyzeEnquiryIntent(record.comment);
            metadata.intent = intent;

            // Extract key information from comment
            const keyInfo = this._extractKeyInformation(record.comment);
            metadata.keyInfo = keyInfo;

            // Create structured content for AI analysis
            const content = `Enquiry Analysis:
                Type: ${record.type}
                Intent: ${intent.category}
                Priority: ${intent.priority}
                Key Information: ${keyInfo.join(', ')}
                
                Original Enquiry: ${record.comment}
                
                Timeline:
                Enquiry Date: ${record.date}
                Created: ${record.firstCreated}
                Last Modified: ${record.lastModified}
                
                Classification:
                - Primary Category: ${intent.category}
                - Secondary Categories: ${intent.secondaryCategories.join(', ')}
                - Action Required: ${intent.actionRequired}
                - Response Priority: ${intent.priority}`;

            return new Document({
                pageContent: content,
                metadata
            });
        });
    }

    _analyzeEnquiryIntent(comment) {
        const lowercaseComment = comment.toLowerCase();
        
        // Define intent patterns
        const intentPatterns = {
            inspection: {
                patterns: ['inspection', 'viewing', 'look at', 'see the', 'open home'],
                priority: 'high',
                actionRequired: 'Schedule inspection'
            },
            pricing: {
                patterns: ['price', 'cost', 'worth', 'figure', 'rate'],
                priority: 'high',
                actionRequired: 'Provide pricing information'
            },
            documentation: {
                patterns: ['contract', 'document', 'paperwork', 'form'],
                priority: 'medium',
                actionRequired: 'Send documentation'
            },
            propertyInfo: {
                patterns: ['detail', 'information', 'about', 'feature', 'room', 'pool'],
                priority: 'medium',
                actionRequired: 'Provide property details'
            },
            availability: {
                patterns: ['available', 'when', 'timing', 'schedule'],
                priority: 'medium',
                actionRequired: 'Confirm availability'
            }
        };

        // Find matching intents
        const matchedIntents = [];
        Object.entries(intentPatterns).forEach(([category, data]) => {
            if (data.patterns.some(pattern => lowercaseComment.includes(pattern))) {
                matchedIntents.push({
                    category,
                    priority: data.priority,
                    actionRequired: data.actionRequired
                });
            }
        });

        // Determine primary intent and secondary categories
        const primaryIntent = matchedIntents[0] || {
            category: 'general',
            priority: 'low',
            actionRequired: 'Review and respond'
        };

        return {
            ...primaryIntent,
            secondaryCategories: matchedIntents.slice(1).map(intent => intent.category)
        };
    }

    _extractKeyInformation(comment) {
        const keyInfo = [];
        
        // Extract timing information
        const timePatterns = [
            'asap', 'urgent', 'today', 'tomorrow', 'weekend',
            'morning', 'afternoon', 'evening', 'night'
        ];
        timePatterns.forEach(pattern => {
            if (comment.toLowerCase().includes(pattern)) {
                keyInfo.push(`Timing: ${pattern}`);
            }
        });

        // Extract specific requirements
        const requirementPatterns = [
            'private', 'specific', 'particular', 'must', 'need',
            'important', 'essential', 'critical'
        ];
        requirementPatterns.forEach(pattern => {
            if (comment.toLowerCase().includes(pattern)) {
                keyInfo.push(`Requirement: ${pattern}`);
            }
        });

        // Extract property features of interest
        const featurePatterns = [
            'bedroom', 'bathroom', 'garage', 'pool', 'garden',
            'parking', 'view', 'location', 'size', 'price'
        ];
        featurePatterns.forEach(pattern => {
            if (comment.toLowerCase().includes(pattern)) {
                keyInfo.push(`Interest: ${pattern}`);
            }
        });

        return keyInfo;
    }
}

class ProspectiveBuyerDocumentCreator extends BaseDocumentCreator {
    constructor() {
        super('prospective_buyer');
    }

    async createDocuments(records) {
        return records.map(record => {
            // Calculate engagement metrics
            const engagementScore = this._calculateEngagementScore(record);
            const activityMetrics = this._calculateActivityMetrics(record);
            const buyerProfile = this._createBuyerProfile(record);
            const timelineAnalysis = this._analyzeTimeline(record);

            const metadata = {
                id: record.id,
                enquirySource: record.enquirySource,
                interestLevel: record.interestLevel,
                priceFeedback: parseFloat(record.priceFeedback) || 0,
                engagement: engagementScore,
                activityMetrics,
                buyerProfile,
                timelineAnalysis,
                firstActivityDate: record.firstActivityDate,
                lastActivityDate: record.lastActivityDate,
                firstCreated: record.firstCreated,
                lastModified: record.lastModified,
                entityType: 'prospective_buyer'
            };

            // Create structured content for AI analysis
            const content = `Prospective Buyer Analysis:
                Interest Level: ${record.interestLevel || 'Not Specified'}
                Price Feedback: $${record.priceFeedback || 'Not Provided'}
                
                Engagement Summary:
                - Overall Score: ${engagementScore.overall.toFixed(2)}
                - Engagement Level: ${engagementScore.level}
                - Key Indicators: ${engagementScore.keyIndicators.join(', ')}
                
                Activity Metrics:
                - Total Enquiries: ${record.totalEnquiries}
                - Total Inspections: ${record.totalInspections}
                - Total Offers: ${record.totalOffers}
                - Total Notes: ${record.totalNotes}
                
                Buyer Profile:
                - Buying Stage: ${buyerProfile.stage}
                - Commitment Level: ${buyerProfile.commitmentLevel}
                - Action Items: ${buyerProfile.actionItems.join(', ')}
                
                Timeline Analysis:
                - Days Active: ${timelineAnalysis.daysActive}
                - Activity Frequency: ${timelineAnalysis.activityFrequency}
                - Last Activity: ${timelineAnalysis.daysSinceLastActivity} days ago
                - Engagement Trend: ${timelineAnalysis.engagementTrend}
                
                Documentation Status:
                - Contract Taken: ${record.contractTaken ? 'Yes' : 'No'}
                - Report Taken: ${record.reportTaken ? 'Yes' : 'No'}
                
                Follow-up Status:
                - Ongoing Interest: ${record.ongoingInterest ? 'Yes' : 'No'}
                - Requires Follow-up: ${record.followUp ? 'Yes' : 'No'}
                
                Next Best Actions:
                ${this._generateNextBestActions(record, engagementScore, timelineAnalysis)}`;

            return new Document({
                pageContent: content,
                metadata
            });
        });
    }

    _calculateEngagementScore(record) {
        const score = {
            overall: 0,
            level: '',
            keyIndicators: []
        };

        // Base engagement factors
        const factors = {
            enquiries: parseInt(record.totalEnquiries) * 0.2,
            inspections: parseInt(record.totalInspections) * 0.3,
            offers: parseInt(record.totalOffers) * 0.4,
            notes: parseInt(record.totalNotes) * 0.1
        };

        // Calculate overall score
        score.overall = Object.values(factors).reduce((a, b) => a + b, 0);

        // Add bonus for recent activity
        const daysSinceLastActivity = this._calculateDaysBetween(record.lastActivityDate, new Date());
        if (daysSinceLastActivity < 7) {
            score.overall *= 1.2;
            score.keyIndicators.push('Recent Activity');
        }

        // Add bonus for contract/report taken
        if (record.contractTaken) {
            score.overall *= 1.3;
            score.keyIndicators.push('Contract Taken');
        }
        if (record.reportTaken) {
            score.overall *= 1.2;
            score.keyIndicators.push('Report Taken');
        }

        // Determine engagement level
        if (score.overall >= 4) {
            score.level = 'Very High';
        } else if (score.overall >= 3) {
            score.level = 'High';
        } else if (score.overall >= 2) {
            score.level = 'Medium';
        } else if (score.overall >= 1) {
            score.level = 'Low';
        } else {
            score.level = 'Very Low';
        }

        // Add interest level indicator
        if (record.interestLevel) {
            score.keyIndicators.push(`Interest: ${record.interestLevel}`);
        }

        return score;
    }

    _calculateActivityMetrics(record) {
        const metrics = {
            totalActivities: 0,
            activityBreakdown: {},
            averageActivitiesPerWeek: 0,
            mostFrequentActivity: ''
        };

        // Sum all activities
        const activities = {
            enquiries: parseInt(record.totalEnquiries),
            inspections: parseInt(record.totalInspections),
            offers: parseInt(record.totalOffers),
            notes: parseInt(record.totalNotes)
        };

        metrics.totalActivities = Object.values(activities).reduce((a, b) => a + b, 0);
        metrics.activityBreakdown = activities;

        // Calculate activity frequency
        const weeksSinceFirst = this._calculateDaysBetween(record.firstActivityDate, record.lastActivityDate) / 7;
        metrics.averageActivitiesPerWeek = weeksSinceFirst > 0 ? 
            metrics.totalActivities / weeksSinceFirst : metrics.totalActivities;

        // Determine most frequent activity
        metrics.mostFrequentActivity = Object.entries(activities)
            .reduce((a, b) => a[1] > b[1] ? a : b)[0];

        return metrics;
    }

    _createBuyerProfile(record) {
        const profile = {
            stage: '',
            commitmentLevel: '',
            actionItems: []
        };

        // Determine buying stage
        if (record.totalOffers > 0) {
            profile.stage = 'Offering';
        } else if (record.totalInspections > 0) {
            profile.stage = 'Inspecting';
        } else if (record.totalEnquiries > 0) {
            profile.stage = 'Enquiring';
        } else {
            profile.stage = 'Initial Contact';
        }

        // Assess commitment level
        if (record.contractTaken && record.totalOffers > 0) {
            profile.commitmentLevel = 'Very High';
        } else if (record.totalInspections > 2) {
            profile.commitmentLevel = 'High';
        } else if (record.totalEnquiries > 3) {
            profile.commitmentLevel = 'Medium';
        } else {
            profile.commitmentLevel = 'Low';
        }

        // Generate action items
        if (!record.contractTaken && profile.stage === 'Offering') {
            profile.actionItems.push('Provide Contract');
        }
        if (record.followUp) {
            profile.actionItems.push('Follow Up Required');
        }
        if (record.ongoingInterest && record.totalInspections === 0) {
            profile.actionItems.push('Schedule Inspection');
        }

        return profile;
    }

    _analyzeTimeline(record) {
        const now = new Date();
        const firstActivity = new Date(record.firstActivityDate);
        const lastActivity = new Date(record.lastActivityDate);

        const analysis = {
            daysActive: this._calculateDaysBetween(firstActivity, now),
            daysSinceLastActivity: this._calculateDaysBetween(lastActivity, now),
            activityFrequency: 'Low',
            engagementTrend: 'Stable'
        };

        // Calculate activity frequency
        const totalActivities = parseInt(record.totalEnquiries) + 
            parseInt(record.totalInspections) + 
            parseInt(record.totalOffers) + 
            parseInt(record.totalNotes);
        
        const activitiesPerDay = totalActivities / analysis.daysActive;
        if (activitiesPerDay >= 0.5) {
            analysis.activityFrequency = 'High';
        } else if (activitiesPerDay >= 0.2) {
            analysis.activityFrequency = 'Medium';
        }

        // Determine engagement trend
        if (analysis.daysSinceLastActivity <= 7 && record.totalOffers > 0) {
            analysis.engagementTrend = 'Increasing';
        } else if (analysis.daysSinceLastActivity > 30) {
            analysis.engagementTrend = 'Decreasing';
        }

        return analysis;
    }

    _calculateDaysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    _generateNextBestActions(record, engagementScore, timelineAnalysis) {
        const actions = [];

        // High priority actions
        if (record.followUp) {
            actions.push('- URGENT: Follow up required based on previous interaction');
        }
        if (engagementScore.level === 'Very High' && !record.contractTaken) {
            actions.push('- Priority: Provide contract and facilitate offer process');
        }

        // Engagement-based actions
        if (timelineAnalysis.daysSinceLastActivity > 14 && engagementScore.level !== 'Very Low') {
            actions.push('- Re-engage: No activity in the past two weeks');
        }
        if (record.totalInspections === 0 && record.totalEnquiries > 0) {
            actions.push('- Convert interest to inspection: Schedule property viewing');
        }

        // Documentation actions
        if (record.totalOffers > 0 && !record.reportTaken) {
            actions.push('- Provide property report to support decision making');
        }

        // If no specific actions, provide general recommendations
        if (actions.length === 0) {
            actions.push('- Maintain regular contact and provide property updates');
        }

        return actions.join('\n');
    }
}

class ListingDocumentCreator extends BaseDocumentCreator {
    constructor() {
        super('listing');
    }

    async createDocuments(records) {
        return records.map(record => {
            const propertyFeatures = this._extractPropertyFeatures(record.property);
            const marketingInfo = this._extractMarketingInfo(record);
            const locationAnalysis = this._analyzeLocation(record.property);
            const priceAnalysis = this._analyzePriceAndValue(record);

            const metadata = {
                id: record.id,
                externalId: record.externalId,
                type: record.type,
                status: record.status,
                marketingStatus: record.marketingStatus,
                propertyId: record.property.id,
                propertyType: record.property.type,
                propertyCategory: record.property.category,
                features: propertyFeatures,
                marketing: marketingInfo,
                location: locationAnalysis,
                pricing: priceAnalysis,
                firstCreated: record.firstCreated,
                lastModified: record.lastModified,
                entityType: 'listing'
            };

            // Create structured content for AI analysis
            const content = `Property Listing Analysis:
                Property Details:
                - Type: ${record.property.type} - ${record.property.category}
                - Status: ${record.status} (${record.marketingStatus})
                - Configuration: ${propertyFeatures.bedrooms} beds, ${propertyFeatures.bathrooms} baths, ${propertyFeatures.parking} parking
                
                Location Analysis:
                - Address: ${locationAnalysis.fullAddress}
                - Region: ${locationAnalysis.region}
                - Location Score: ${locationAnalysis.locationScore}
                - Key Features: ${locationAnalysis.keyFeatures.join(', ')}
                
                Marketing Analysis:
                - Days on Market: ${marketingInfo.daysOnMarket}
                - Marketing Headline: ${record.mainHeadline}
                - Web Presence: ${marketingInfo.hasWebLink ? 'Yes' : 'No'}
                - Visibility: ${record.hiddenListing ? 'Hidden' : 'Visible'}
                
                Price Analysis:
                - Display Price: ${record.displayPrice}
                - Price Category: ${priceAnalysis.priceCategory}
                - Value Indicators: ${priceAnalysis.valueIndicators.join(', ')}
                
                Property Features:
                - Size: ${this._formatSize(record.property)}
                - Construction: ${record.property.newConstruction ? 'New Construction' : 'Established'}
                - Additional Features: ${propertyFeatures.additionalFeatures.join(', ')}
                
                Market Position:
                - Property Class: ${this._determinePropertyClass(record)}
                - Target Market: ${this._analyzeTargetMarket(record)}
                - Investment Potential: ${this._assessInvestmentPotential(record)}
                
                Matching Criteria:
                ${this._generateMatchingCriteria(record)}`;

            return new Document({
                pageContent: content,
                metadata
            });
        });
    }

    _extractPropertyFeatures(property) {
        return {
            bedrooms: parseInt(property.bedrooms) || 0,
            bathrooms: parseInt(property.bathrooms) || 0,
            parking: parseInt(property.totalParking) || 0,
            landArea: property.landArea,
            buildingArea: property.buildingArea,
            additionalFeatures: this._identifyAdditionalFeatures(property)
        };
    }

    _extractMarketingInfo(record) {
        const listedDate = record.listedDate ? new Date(record.listedDate) : null;
        const now = new Date();
        
        return {
            headline: record.mainHeadline,
            hasWebLink: !!record.webLink,
            daysOnMarket: listedDate ? Math.floor((now - listedDate) / (1000 * 60 * 60 * 24)) : 0,
            marketingMethod: record.method || 'Standard',
            isOffMarket: record.offMarketListing,
            isHidden: record.hiddenListing
        };
    }

    _analyzeLocation(property) {
        const address = property.address;
        return {
            fullAddress: this._formatAddress(address),
            region: address.region,
            locationScore: this._calculateLocationScore(property),
            keyFeatures: this._identifyLocationFeatures(property),
            coordinates: property.location
        };
    }

    _analyzePriceAndValue(record) {
        return {
            displayPrice: record.displayPrice,
            priceCategory: this._determinePriceCategory(record),
            valueIndicators: this._identifyValueIndicators(record),
            priceType: this._analyzePriceType(record.displayPrice)
        };
    }

    _formatAddress(address) {
        const parts = [];
        if (address.unitNum) parts.push(`Unit ${address.unitNum}`);
        if (address.streetNum) parts.push(address.streetNum);
        if (address.streetName) parts.push(address.streetName);
        if (address.streetType) parts.push(address.streetType);
        parts.push(address.suburb);
        parts.push(address.state);
        parts.push(address.postcode);
        
        return parts.join(' ');
    }

    _formatSize(property) {
        const parts = [];
        if (property.landArea.value) {
            parts.push(`Land: ${property.landArea.value}${property.landArea.unit}`);
        }
        if (property.buildingArea.value) {
            parts.push(`Building: ${property.buildingArea.value}${property.buildingArea.unit}`);
        }
        return parts.length > 0 ? parts.join(', ') : 'Size not specified';
    }

    _calculateLocationScore(property) {
        let score = 0;
        
        // Region-based scoring
        if (property.address.region) score += 0.2;
        
        // Coordinates-based scoring
        if (property.location.lat && property.location.long) score += 0.3;
        
        // Address completeness scoring
        const address = property.address;
        if (address.streetName && address.streetNum) score += 0.2;
        if (address.suburb && address.postcode) score += 0.3;
        
        return score.toFixed(2);
    }

    _identifyLocationFeatures(property) {
        const features = [];
        const address = property.address;
        
        if (address.region) features.push(address.region);
        if (property.location.lat && property.location.long) features.push('Geo-located');
        if (!address.hideAddress) features.push('Full address displayed');
        
        return features;
    }

    _identifyAdditionalFeatures(property) {
        const features = [];
        
        if (property.newConstruction) features.push('New Construction');
        if (property.name) features.push(property.name);
        
        return features;
    }

    _determinePriceCategory(record) {
        const price = this._extractNumericPrice(record.displayPrice);
        if (!price) return 'Unknown';
        
        if (record.type === 'Lease') {
            if (price < 500) return 'Budget';
            if (price < 1000) return 'Mid-range';
            return 'Premium';
        } else {
            if (price < 500000) return 'Entry Level';
            if (price < 1000000) return 'Mid-market';
            if (price < 2000000) return 'Premium';
            return 'Luxury';
        }
    }

    _extractNumericPrice(displayPrice) {
        if (!displayPrice) return 0;
        return parseFloat(displayPrice.replace(/[^0-9.]/g, '')) || 0;
    }

    _identifyValueIndicators(record) {
        const indicators = [];
        const property = record.property;
        
        if (property.newConstruction) indicators.push('New Build');
        if (property.location.lat) indicators.push('Prime Location');
        if (parseInt(property.bedrooms) >= 4) indicators.push('Family Sized');
        if (record.type === 'Lease' && record.bond) indicators.push('Bond Required');
        
        return indicators;
    }

    _analyzePriceType(displayPrice) {
        if (!displayPrice) return 'Not Specified';
        if (displayPrice.includes('$')) return 'Fixed Price';
        if (displayPrice.toLowerCase().includes('auction')) return 'Auction';
        if (displayPrice.toLowerCase().includes('contact')) return 'Contact Agent';
        return 'Other';
    }

    _determinePropertyClass(record) {
        const property = record.property;
        const features = parseInt(property.bedrooms) + 
                        parseInt(property.bathrooms) + 
                        parseInt(property.totalParking);
        
        if (features >= 8) return 'Luxury';
        if (features >= 6) return 'Premium';
        if (features >= 4) return 'Standard';
        return 'Basic';
    }

    _analyzeTargetMarket(record) {
        const property = record.property;
        const segments = [];
        
        // Configuration-based targeting
        if (parseInt(property.bedrooms) >= 4) {
            segments.push('Family');
        } else if (parseInt(property.bedrooms) <= 2) {
            segments.push('Singles/Couples');
        }
        
        // Type-based targeting
        if (property.category === 'Apartment') {
            segments.push('Urban Professionals');
        } else if (property.category === 'House') {
            segments.push('Home Buyers');
        }
        
        return segments.join(', ') || 'General Market';
    }

    _assessInvestmentPotential(record) {
        const factors = [];
        const property = record.property;
        
        if (property.type === 'Residential' && record.type === 'Lease') {
            factors.push('Rental Income Potential');
        }
        
        if (property.newConstruction) {
            factors.push('New Build Premium');
        }
        
        if (property.location.lat && property.location.long) {
            factors.push('Location Asset');
        }
        
        return factors.join(', ') || 'Standard Investment';
    }

    _generateMatchingCriteria(record) {
        const criteria = [];
        const property = record.property;
        
        criteria.push(`- Property Type: ${property.type} - ${property.category}`);
        criteria.push(`- Size: ${property.bedrooms} beds, ${property.bathrooms} baths`);
        criteria.push(`- Location: ${property.address.suburb}, ${property.address.state}`);
        criteria.push(`- Price Range: ${record.displayPrice}`);
        
        if (property.newConstruction) {
            criteria.push('- Condition: New Construction');
        }
        
        return criteria.join('\n');
    }
}

class ContactDocumentCreator extends BaseDocumentCreator {
    constructor() {
        super('contact');
    }

    async createDocuments(records) {
        return records.map(record => {
            const contactProfile = this._createContactProfile(record);
            const communicationPreferences = this._analyzeCommunicationPreferences(record);
            const engagementMetrics = this._calculateEngagementMetrics(record);
            const relationshipStatus = this._analyzeRelationshipStatus(record);

            const metadata = {
                id: record.id,
                type: record.type,
                status: record.status,
                profile: contactProfile,
                communication: communicationPreferences,
                engagement: engagementMetrics,
                relationship: relationshipStatus,
                source: record.source,
                firstCreated: record.firstCreated,
                lastModified: record.lastModified,
                entityType: 'contact'
            };

            // Create structured content for AI analysis
            const content = `Contact Analysis:
                Personal Information:
                - Name: ${this._formatName(record)}
                - Type: ${record.type}
                - Status: ${record.status}
                - Company: ${record.companyName || 'Not specified'}
                - Job Title: ${record.jobTitle || 'Not specified'}
                
                Contact Profile:
                - Category: ${contactProfile.category}
                - Lifecycle Stage: ${contactProfile.lifecycleStage}
                - Profile Completeness: ${contactProfile.completeness}%
                - Key Attributes: ${contactProfile.keyAttributes.join(', ')}
                
                Communication Preferences:
                - Primary Channel: ${communicationPreferences.primaryChannel}
                - Available Channels: ${communicationPreferences.availableChannels.join(', ')}
                - Contact Quality: ${communicationPreferences.contactQuality}
                - Best Contact Time: ${communicationPreferences.bestContactTime}
                
                Engagement Analysis:
                - Engagement Score: ${engagementMetrics.score.toFixed(2)}
                - Last Activity: ${engagementMetrics.lastActivity}
                - Activity Level: ${engagementMetrics.activityLevel}
                - Engagement Trend: ${engagementMetrics.trend}
                
                Relationship Status:
                - Duration: ${relationshipStatus.duration}
                - Strength: ${relationshipStatus.strength}
                - Last Interaction: ${relationshipStatus.lastInteraction}
                - Key Interactions: ${relationshipStatus.keyInteractions.join(', ')}
                
                Source Information:
                - Origin: ${record.source}
                - First Created: ${record.firstCreated}
                - Last Modified: ${record.lastModified}
                
                Next Best Actions:
                ${this._generateNextBestActions(record, engagementMetrics)}`;

            return new Document({
                pageContent: content,
                metadata
            });
        });
    }

    _createContactProfile(record) {
        const profile = {
            category: this._determineCategory(record),
            lifecycleStage: this._determineLifecycleStage(record),
            completeness: this._calculateProfileCompleteness(record),
            keyAttributes: this._identifyKeyAttributes(record)
        };

        return profile;
    }

    _analyzeCommunicationPreferences(record) {
        const channels = this._identifyAvailableChannels(record);
        return {
            primaryChannel: this._determinePrimaryChannel(channels),
            availableChannels: channels,
            contactQuality: this._assessContactQuality(record),
            bestContactTime: this._determineBestContactTime(record)
        };
    }

    _calculateEngagementMetrics(record) {
        const daysSinceModified = this._calculateDaysBetween(new Date(record.lastModified), new Date());
        const daysSinceCreated = this._calculateDaysBetween(new Date(record.firstCreated), new Date());

        return {
            score: this._calculateEngagementScore(record, daysSinceModified),
            lastActivity: this._formatTimeAgo(daysSinceModified),
            activityLevel: this._determineActivityLevel(daysSinceModified),
            trend: this._determineEngagementTrend(record, daysSinceModified, daysSinceCreated)
        };
    }

    _analyzeRelationshipStatus(record) {
        const daysSinceCreated = this._calculateDaysBetween(new Date(record.firstCreated), new Date());
        
        return {
            duration: this._formatDuration(daysSinceCreated),
            strength: this._calculateRelationshipStrength(record),
            lastInteraction: this._formatTimeAgo(this._calculateDaysBetween(new Date(record.lastModified), new Date())),
            keyInteractions: this._identifyKeyInteractions(record)
        };
    }

    _formatName(record) {
        const parts = [];
        if (record.title) parts.push(record.title);
        if (record.firstName) parts.push(record.firstName);
        if (record.lastName) parts.push(record.lastName);
        return parts.join(' ') || 'Unknown';
    }

    _determineCategory(record) {
        if (record.type === 'Person') {
            if (record.companyName) return 'Business Contact';
            return 'Individual';
        }
        return 'Organization';
    }

    _determineLifecycleStage(record) {
        // Determine lifecycle stage based on activity and status
        const daysSinceModified = this._calculateDaysBetween(new Date(record.lastModified), new Date());
        
        if (record.status !== 'Active') return 'Inactive';
        if (daysSinceModified > 180) return 'Dormant';
        if (daysSinceModified > 90) return 'At Risk';
        return 'Active';
    }

    _calculateProfileCompleteness(record) {
        const fields = [
            'firstName', 'lastName', 'email', 'mobile', 
            'homePhone', 'workPhone', 'jobTitle', 'companyName'
        ];
        
        const completedFields = fields.filter(field => record[field]);
        return Math.round((completedFields.length / fields.length) * 100);
    }

    _identifyKeyAttributes(record) {
        const attributes = [];
        
        if (record.jobTitle) attributes.push('Professional');
        if (record.companyName) attributes.push('Business Associated');
        if (record.email && record.mobile) attributes.push('Fully Contactable');
        if (record.status === 'Active') attributes.push('Active Contact');
        
        return attributes;
    }

    _identifyAvailableChannels(record) {
        const channels = [];
        
        if (record.email) channels.push('Email');
        if (record.mobile) channels.push('Mobile');
        if (record.homePhone) channels.push('Home Phone');
        if (record.workPhone) channels.push('Work Phone');
        if (record.website) channels.push('Website');
        
        return channels;
    }

    _determinePrimaryChannel(channels) {
        const priorityOrder = ['Mobile', 'Email', 'Work Phone', 'Home Phone', 'Website'];
        return channels.sort((a, b) => 
            priorityOrder.indexOf(a) - priorityOrder.indexOf(b)
        )[0] || 'None';
    }

    _assessContactQuality(record) {
        let score = 0;
        
        if (record.email) score += 0.3;
        if (record.mobile) score += 0.3;
        if (record.homePhone || record.workPhone) score += 0.2;
        if (record.website) score += 0.1;
        if (record.companyName) score += 0.1;
        
        if (score >= 0.8) return 'Excellent';
        if (score >= 0.6) return 'Good';
        if (score >= 0.4) return 'Fair';
        return 'Poor';
    }

    _determineBestContactTime(record) {
        // Simple logic - can be enhanced with actual contact history
        if (record.workPhone) return 'Business Hours';
        if (record.homePhone) return 'Evening';
        return 'Any Time';
    }

    _calculateEngagementScore(record, daysSinceModified) {
        let score = 1.0;
        
        // Decay based on last modification
        score *= Math.exp(-daysSinceModified / 365);
        
        // Boost for completeness
        score *= (this._calculateProfileCompleteness(record) / 100);
        
        // Boost for available channels
        score *= (this._identifyAvailableChannels(record).length / 5);
        
        return score;
    }

    _determineActivityLevel(daysSinceModified) {
        if (daysSinceModified <= 30) return 'High';
        if (daysSinceModified <= 90) return 'Medium';
        if (daysSinceModified <= 180) return 'Low';
        return 'Inactive';
    }

    _determineEngagementTrend(record, daysSinceModified, daysSinceCreated) {
        if (daysSinceModified <= 30) return 'Active';
        if (daysSinceModified <= daysSinceCreated / 2) return 'Stable';
        return 'Declining';
    }

    _calculateRelationshipStrength(record) {
        const completeness = this._calculateProfileCompleteness(record);
        const channels = this._identifyAvailableChannels(record).length;
        const daysSinceCreated = this._calculateDaysBetween(new Date(record.firstCreated), new Date());
        
        let strength = (completeness / 100) * 0.4;  // 40% weight on profile completeness
        strength += (channels / 5) * 0.3;           // 30% weight on communication channels
        strength += Math.min(daysSinceCreated / 365, 1) * 0.3;  // 30% weight on relationship duration
        
        if (strength >= 0.8) return 'Strong';
        if (strength >= 0.6) return 'Moderate';
        if (strength >= 0.4) return 'Developing';
        return 'New';
    }

    _identifyKeyInteractions(record) {
        const interactions = [];
        
        if (record.source) interactions.push(`Initial ${record.source}`);
        if (record.lastModified !== record.firstCreated) {
            interactions.push('Profile Updated');
        }
        
        return interactions;
    }

    _calculateDaysBetween(date1, date2) {
        const diffTime = Math.abs(date2 - date1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    _formatTimeAgo(days) {
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        if (days < 365) return `${Math.floor(days / 30)} months ago`;
        return `${Math.floor(days / 365)} years ago`;
    }

    _formatDuration(days) {
        if (days < 30) return `${days} days`;
        if (days < 365) return `${Math.floor(days / 30)} months`;
        return `${Math.floor(days / 365)} years`;
    }

    _generateNextBestActions(record, engagementMetrics) {
        const actions = [];

        // Engagement-based actions
        if (engagementMetrics.activityLevel === 'Inactive') {
            actions.push('- Re-engagement: Initiate contact to revive relationship');
        }
        if (engagementMetrics.trend === 'Declining') {
            actions.push('- Engagement: Schedule follow-up to maintain relationship');
        }

        // Profile completion actions
        const completeness = this._calculateProfileCompleteness(record);
        if (completeness < 80) {
            actions.push('- Profile: Update contact information to improve completeness');
        }

        // Communication channel actions
        const channels = this._identifyAvailableChannels(record);
        if (!channels.includes('Email')) {
            actions.push('- Contact: Obtain email address for digital communication');
        }
        if (!channels.includes('Mobile')) {
            actions.push('- Contact: Obtain mobile number for direct communication');
        }

        // If no specific actions, provide general recommendation
        if (actions.length === 0) {
            actions.push('- Maintain regular contact to strengthen relationship');
        }

        return actions.join('\n');
    }
}

class SearchRequirementDocumentCreator extends BaseDocumentCreator {
    constructor() {
        super('search_requirement');
    }

    async createDocuments(records) {
        return records.map(record => {
            const propertyPreferences = this._analyzePropertyPreferences(record);
            const priceAnalysis = this._analyzePricePreferences(record);
            const locationPreferences = this._analyzeLocationPreferences(record);
            const buyerProfile = this._createBuyerProfile(record);
            const matchingCriteria = this._generateMatchingCriteria(record);

            const metadata = {
                id: record.id,
                contactId: record.contactId,
                listingType: record.listingType,
                propertyType: record.propertyType,
                propertyCategories: record.propertyCategories.map(c => c.name),
                preferences: propertyPreferences,
                priceAnalysis,
                locationPreferences,
                buyerProfile,
                matchingCriteria,
                firstCreated: record.firstCreated,
                lastModified: record.lastModified,
                entityType: 'search_requirement'
            };

            // Create structured content for AI analysis
            const content = `Search Requirement Analysis:
                Basic Information:
                - Type: ${record.listingType} - ${record.propertyType}
                - Categories: ${record.propertyCategories.map(c => c.name).join(', ')}
                - Contact ID: ${record.contactId}
                
                Property Preferences:
                - Configuration: ${propertyPreferences.configuration}
                - Size Requirements: ${propertyPreferences.sizeRequirements}
                - Must-Have Features: ${propertyPreferences.mustHaveFeatures}
                - Flexibility Score: ${propertyPreferences.flexibilityScore.toFixed(2)}
                
                Price Analysis:
                - Range: ${priceAnalysis.formattedRange}
                - Budget Category: ${priceAnalysis.budgetCategory}
                - Price Point: ${priceAnalysis.pricePoint}
                - Market Position: ${priceAnalysis.marketPosition}
                
                Location Preferences:
                - Target Areas: ${locationPreferences.targetAreas}
                - Search Radius: ${locationPreferences.searchRadius}
                - Area Type: ${locationPreferences.areaType}
                - Location Flexibility: ${locationPreferences.flexibility}
                
                Buyer Profile:
                - Buyer Type: ${buyerProfile.buyerType}
                - Search Stage: ${buyerProfile.searchStage}
                - Requirements Clarity: ${buyerProfile.requirementsClarity}
                - Priority Factors: ${buyerProfile.priorityFactors.join(', ')}
                
                Matching Criteria:
                ${matchingCriteria.map(c => `- ${c}`).join('\n')}
                
                Timeline:
                - Created: ${record.firstCreated}
                - Last Modified: ${record.lastModified}
                
                Next Best Actions:
                ${this._generateNextBestActions(record, propertyPreferences, priceAnalysis)}`;

            return new Document({
                pageContent: content,
                metadata
            });
        });
    }

    _analyzePropertyPreferences(record) {
        const preferences = {
            configuration: this._formatConfiguration(record),
            sizeRequirements: this._formatSizeRequirements(record),
            mustHaveFeatures: this._identifyMustHaveFeatures(record),
            flexibilityScore: this._calculateFlexibilityScore(record)
        };

        return preferences;
    }

    _analyzePricePreferences(record) {
        const price = record.price || {};
        return {
            formattedRange: this._formatPriceRange(price),
            budgetCategory: this._determineBudgetCategory(price, record.listingType),
            pricePoint: this._calculatePricePoint(price),
            marketPosition: this._determineMarketPosition(price, record.propertyType)
        };
    }

    _analyzeLocationPreferences(record) {
        return {
            targetAreas: this._formatTargetAreas(record),
            searchRadius: this._determineSearchRadius(record),
            areaType: this._determineAreaType(record),
            flexibility: this._assessLocationFlexibility(record)
        };
    }

    _createBuyerProfile(record) {
        return {
            buyerType: this._determineBuyerType(record),
            searchStage: this._determineSearchStage(record),
            requirementsClarity: this._assessRequirementsClarity(record),
            priorityFactors: this._identifyPriorityFactors(record)
        };
    }

    _formatConfiguration(record) {
        const parts = [];
        
        if (record.bedrooms?.from) {
            parts.push(`${record.bedrooms.from}${record.bedrooms.to ? '-' + record.bedrooms.to : '+'} beds`);
        }
        if (record.bathrooms?.from) {
            parts.push(`${record.bathrooms.from}${record.bathrooms.to ? '-' + record.bathrooms.to : '+'} baths`);
        }
        if (record.parking?.from) {
            parts.push(`${record.parking.from}${record.parking.to ? '-' + record.parking.to : '+'} parking`);
        }
        
        return parts.join(', ') || 'No specific configuration';
    }

    _formatSizeRequirements(record) {
        const parts = [];
        
        if (record.landArea?.from || record.landArea?.to) {
            parts.push(`Land: ${record.landArea.from || '0'}-${record.landArea.to || '∞'}${record.landArea.unit}`);
        }
        if (record.buildingArea?.from || record.buildingArea?.to) {
            parts.push(`Building: ${record.buildingArea.from || '0'}-${record.buildingArea.to || '∞'}${record.buildingArea.unit}`);
        }
        
        return parts.join(', ') || 'No specific size requirements';
    }

    _identifyMustHaveFeatures(record) {
        const features = [];
        
        if (record.features && record.matchAllFeatures) {
            features.push(...record.features);
        }
        if (record.propertyCategories?.length === 1) {
            features.push(`Must be ${record.propertyCategories[0].name}`);
        }
        
        return features;
    }

    _calculateFlexibilityScore(record) {
        let score = 1.0;
        
        // Reduce score for strict requirements
        if (record.matchAllFeatures) score *= 0.8;
        if (record.propertyCategories?.length === 1) score *= 0.9;
        if (!record.surroundingSuburbs) score *= 0.9;
        
        // Reduce score for narrow ranges
        if (record.price?.from && record.price?.to) {
            const range = (record.price.to - record.price.from) / record.price.from;
            score *= (0.5 + Math.min(range, 0.5));
        }
        
        return score;
    }

    _formatPriceRange(price) {
        if (!price) return 'Not specified';
        
        const from = price.from ? `$${parseInt(price.from).toLocaleString()}` : 'Any';
        const to = price.to ? `$${parseInt(price.to).toLocaleString()}` : 'Any';
        const unit = price.unit ? ` per ${price.unit}` : '';
        
        return `${from} to ${to}${unit}`;
    }

    _determineBudgetCategory(price, listingType) {
        if (!price?.from) return 'Unknown';
        
        const amount = parseInt(price.from);
        if (listingType === 'Lease') {
            if (amount < 500) return 'Budget';
            if (amount < 1000) return 'Mid-range';
            return 'Premium';
        } else {
            if (amount < 500000) return 'Entry Level';
            if (amount < 1000000) return 'Mid-market';
            if (amount < 2000000) return 'Premium';
            return 'Luxury';
        }
    }

    _calculatePricePoint(price) {
        if (!price?.from || !price?.to) return 'Open';
        return `$${Math.round((parseInt(price.from) + parseInt(price.to)) / 2).toLocaleString()}`;
    }

    _determineMarketPosition(price, propertyType) {
        if (!price?.from) return 'Unknown';
        
        // This would ideally be based on market data
        return 'Market Average';
    }

    _formatTargetAreas(record) {
        const areas = [];
        if (record.suburbs?.length) areas.push(...record.suburbs);
        if (record.regions?.length) areas.push(...record.regions);
        return areas.length ? areas.join(', ') : 'No specific areas';
    }

    _determineSearchRadius(record) {
        if (record.surroundingSuburbs) return 'Including surrounding areas';
        if (record.suburbs?.length || record.regions?.length) return 'Specific areas only';
        return 'No radius specified';
    }

    _determineAreaType(record) {
        if (record.regions?.length) return 'Regional search';
        if (record.suburbs?.length) return 'Suburb-specific';
        return 'Open to all areas';
    }

    _assessLocationFlexibility(record) {
        if (!record.suburbs?.length && !record.regions?.length) return 'Very Flexible';
        if (record.surroundingSuburbs) return 'Moderately Flexible';
        return 'Specific Areas Only';
    }

    _determineBuyerType(record) {
        if (record.investment === 'Yes') return 'Investor';
        if (record.listingType === 'Lease') return 'Tenant';
        return 'Owner Occupier';
    }

    _determineSearchStage(record) {
        const daysSinceModified = this._calculateDaysBetween(new Date(record.lastModified), new Date());
        
        if (daysSinceModified > 90) return 'Inactive';
        if (daysSinceModified > 30) return 'Passive';
        return 'Active';
    }

    _assessRequirementsClarity(record) {
        let score = 0;
        
        if (record.propertyCategories?.length) score += 0.2;
        if (record.price?.from && record.price?.to) score += 0.2;
        if (record.bedrooms?.from) score += 0.2;
        if (record.suburbs?.length || record.regions?.length) score += 0.2;
        if (record.features?.length) score += 0.2;
        
        if (score >= 0.8) return 'Very Clear';
        if (score >= 0.6) return 'Clear';
        if (score >= 0.4) return 'Somewhat Clear';
        return 'Needs Clarification';
    }

    _identifyPriorityFactors(record) {
        const factors = [];
        
        if (record.price?.from && record.price?.to) factors.push('Budget Conscious');
        if (record.propertyCategories?.length === 1) factors.push('Specific Property Type');
        if (record.features?.length && record.matchAllFeatures) factors.push('Feature Specific');
        if (record.suburbs?.length && !record.surroundingSuburbs) factors.push('Location Specific');
        if (record.bedrooms?.from && record.bedrooms?.from >= 3) factors.push('Family Sized');
        
        return factors;
    }

    _generateMatchingCriteria(record) {
        const criteria = [];
        
        // Property type criteria
        criteria.push(`Property Type: ${record.propertyType} - ${record.propertyCategories.map(c => c.name).join('/')}`);
        
        // Configuration criteria
        if (record.bedrooms?.from) {
            criteria.push(`Bedrooms: ${record.bedrooms.from}${record.bedrooms.to ? '-' + record.bedrooms.to : '+'}`);
        }
        if (record.bathrooms?.from) {
            criteria.push(`Bathrooms: ${record.bathrooms.from}${record.bathrooms.to ? '-' + record.bathrooms.to : '+'}`);
        }
        
        // Price criteria
        if (record.price?.from || record.price?.to) {
            criteria.push(`Price: ${this._formatPriceRange(record.price)}`);
        }
        
        // Location criteria
        if (record.suburbs?.length || record.regions?.length) {
            criteria.push(`Location: ${this._formatTargetAreas(record)}`);
        }
        
        // Feature criteria
        if (record.features?.length) {
            criteria.push(`Features: ${record.features.join(', ')}`);
        }
        
        return criteria;
    }

    _calculateDaysBetween(date1, date2) {
        const diffTime = Math.abs(date2 - date1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    _generateNextBestActions(record, propertyPreferences, priceAnalysis) {
        const actions = [];

        // Requirement clarification actions
        if (propertyPreferences.flexibilityScore < 0.5) {
            actions.push('- Review strict requirements to potentially expand options');
        }
        if (!record.suburbs?.length && !record.regions?.length) {
            actions.push('- Define preferred locations to improve matching');
        }

        // Budget-based actions
        if (!record.price?.to) {
            actions.push('- Establish maximum budget for better targeting');
        }

        // Feature-based actions
        if (!record.features?.length) {
            actions.push('- Identify must-have features for better matching');
        }

        // Search optimization actions
        if (record.surroundingSuburbs === false && record.suburbs?.length) {
            actions.push('- Consider including surrounding suburbs for more options');
        }

        // If no specific actions, provide general recommendation
        if (actions.length === 0) {
            actions.push('- Monitor new listings matching these requirements');
        }

        return actions.join('\n');
    }
}

module.exports = {
    AgentboxDocumentCreator,
    EnquiryDocumentCreator,
    ProspectiveBuyerDocumentCreator,
    ListingDocumentCreator,
    ContactDocumentCreator,
    SearchRequirementDocumentCreator
        };