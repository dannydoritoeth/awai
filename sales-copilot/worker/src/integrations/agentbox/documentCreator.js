const { Document } = require("@langchain/core/documents");
const { BaseDocumentCreator } = require('../baseDocumentCreator');

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