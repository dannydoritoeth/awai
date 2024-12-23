export interface Form6Data {
  // Delivery Details
  deliveryMethod: 'email' | 'hardcopy'
  requiredDateTime: string
  
  // Seller Details
  sellerName: string
  sellerAddress: string
  sellerPhone: string
  sellerEmail: string
  
  // Property Details
  propertyAddress: string
  titleReference: string
  spNumber: string
  saleMethod: 'private' | 'auction'
  listPrice?: string
  auctionDetails?: {
    date: string
    venue: string
    time: string
  }
  
  // Property Features
  propertyType: 'house' | 'unit' | 'land' | 'other'
  bedrooms: number
  bathrooms: number
  carSpaces: number
  pool: boolean
  bodyCorp: boolean
  electricalSafetySwitch: boolean
  smokeAlarms: boolean
  adviceToMarketPrice: boolean
  
  // Property Status
  tenancyDetails?: {
    tenantNames: string[]
    leaseStart: string
    leaseEnd: string
    weeklyRent: string
    bondAmount: string
  }
  
  // Compliance & Legal
  sellerWarranties: 'yes' | 'no' | 'na'
  heritageListed: 'yes' | 'no' | 'na'
  contaminatedLand: 'yes' | 'no' | 'na'
  environmentManagement: 'yes' | 'no' | 'na'
  presentLandUse: 'yes' | 'no' | 'na'
  neighbourhoodDisputes: boolean
  encumbrances: boolean
  gstApplicable: boolean
  commission: number
  authorisedMarketing: boolean
} 