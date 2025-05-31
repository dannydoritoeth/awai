import { logger } from '../utils/logger.js';
import crypto from 'crypto';

function generateDeterministicId(input) {
  const hash = crypto.createHash('sha256');
  hash.update(input);
  return hash.digest('hex').substring(0, 32); // Use first 32 chars for a manageable ID
}

function generateCapabilityId(name, groupName) {
  return generateDeterministicId(`capability_${groupName}_${name}`);
}

function generateLevelId(capabilityId, level) {
  return generateDeterministicId(`level_${capabilityId}_${level}`);
}

const frameworkStructure = {
  'Personal Attributes': [
    {
      name: 'Display Resilience and Courage',
      description: 'Be open and honest, prepared to express your views, and willing to accept and commit to change',
      behavioralIndicators: {
        'Foundational': [
          'Shows awareness of own emotions and how they impact others',
          'Remains calm and objective in challenging situations',
          'Acknowledges mistakes and learns from them',
          'Open to feedback and willing to adapt approach'
        ],
        'Intermediate': [
          'Remains composed under pressure and in challenging situations',
          'Speaks up and expresses opinions constructively',
          'Works through challenges independently',
          'Responds flexibly to changing circumstances'
        ],
        'Adept': [
          'Maintains composure and focus under pressure',
          'Challenges issues constructively and stands ground when appropriate',
          'Demonstrates tenacity and persists with initiatives that are of benefit to the organization',
          'Initiates discussions on issues and takes responsibility for outcomes'
        ],
        'Advanced': [
          'Models composure and resilience in high pressure situations',
          'Creates an environment where others feel confident to challenge and take calculated risks',
          'Provides clear direction in crisis situations',
          'Champions and drives organizational change initiatives'
        ],
        'Highly Advanced': [
          'Creates a culture that embraces challenge and supports resilience',
          'Pioneers innovative approaches to address complex challenges',
          'Exemplifies personal courage in driving critical changes',
          'Sets organizational tone for dealing with ambiguity and uncertainty'
        ]
      }
    },
    {
      name: 'Act with Integrity',
      description: 'Be ethical and professional, and adhere to the public sector values',
      behavioralIndicators: {
        'Foundational': [
          'Behaves in an honest and ethical way',
          'Takes responsibility for own actions',
          'Follows policies and procedures as required',
          'Maintains confidentiality of information'
        ],
        'Intermediate': [
          'Represents the organization professionally',
          'Supports a culture of integrity and professionalism',
          'Identifies and reports misconduct and inappropriate behavior',
          'Acts on opportunities to support others to do the right thing'
        ],
        'Adept': [
          'Models the highest standards of ethical behavior',
          'Promotes a culture of integrity and professionalism',
          'Identifies and addresses risks to integrity',
          'Takes action against others\' inappropriate behavior'
        ],
        'Advanced': [
          'Champions and acts as an advocate for ethical behavior',
          'Sets clear expectations around standards of behavior',
          'Implements systems to assure integrity',
          'Challenges unethical practices at all levels'
        ],
        'Highly Advanced': [
          'Drives a culture of integrity and ethical behavior',
          'Defines and aligns organizational values with public sector values',
          'Creates systems and processes that promote ethical behavior',
          'Takes strong action on suspected breaches of rules, standards and policies'
        ]
      }
    },
    {
      name: 'Manage Self',
      description: 'Show drive and motivation, a measured approach and a commitment to learning',
      behavioralIndicators: {
        'Foundational': [
          'Seeks feedback and responds positively',
          'Shows commitment to learning and development',
          'Maintains work-life balance and personal wellbeing',
          'Recognizes own limitations and seeks guidance'
        ],
        'Intermediate': [
          'Plans and prioritizes work effectively',
          'Takes responsibility for own development',
          'Seeks opportunities for growth and learning',
          'Maintains energy and focus'
        ],
        'Adept': [
          'Acts as a role model for self-management',
          'Pursues self-development opportunities',
          'Seeks and responds well to feedback',
          'Maintains high levels of personal motivation'
        ],
        'Advanced': [
          'Models self-management and motivates others',
          'Creates development opportunities for self and others',
          'Demonstrates and promotes resilience',
          'Champions work-life balance'
        ],
        'Highly Advanced': [
          'Creates organizational culture of self-improvement',
          'Drives continuous learning at all levels',
          'Builds sustainable high-performance culture',
          'Champions personal and professional development'
        ]
      }
    },
    {
      name: 'Value Diversity',
      description: 'Show respect for diverse backgrounds, experiences and perspectives',
      behavioralIndicators: {
        'Foundational': [
          'Treats people with respect and courtesy',
          'Acknowledges different perspectives',
          'Works effectively with diverse individuals',
          'Supports inclusive practices'
        ],
        'Intermediate': [
          'Promotes inclusive work practices',
          'Recognizes and values individual differences',
          'Supports diversity initiatives',
          'Challenges biased behavior'
        ],
        'Adept': [
          'Champions diversity and inclusion',
          'Creates inclusive team environments',
          'Leverages diverse perspectives',
          'Addresses discrimination and bias'
        ],
        'Advanced': [
          'Drives diversity and inclusion strategies',
          'Builds diverse and inclusive teams',
          'Promotes benefits of diversity',
          'Implements systemic changes to support inclusion'
        ],
        'Highly Advanced': [
          'Sets organizational diversity strategy',
          'Creates culture of inclusion and respect',
          'Drives systemic change for diversity',
          'Champions diversity at all levels'
        ]
      }
    }
  ],
  'Relationships': [
    {
      name: 'Communicate Effectively',
      description: 'Communicate clearly, actively listen to others and respond with respect',
      behavioralIndicators: {
        'Foundational': [
          'Listens actively to others',
          'Expresses ideas clearly',
          'Shares information appropriately',
          'Uses appropriate communication channels'
        ],
        'Intermediate': [
          'Tailors communication to audience',
          'Presents information effectively',
          'Writes clear and concise documents',
          'Facilitates open communication'
        ],
        'Adept': [
          'Negotiates persuasively',
          'Communicates complex information clearly',
          'Facilitates constructive discussions',
          'Addresses challenging conversations'
        ],
        'Advanced': [
          'Communicates strategic vision',
          'Handles sensitive communications',
          'Influences diverse stakeholders',
          'Drives organizational communication'
        ],
        'Highly Advanced': [
          'Shapes strategic messaging',
          'Articulates complex concepts',
          'Manages critical communications',
          'Builds communication capability'
        ]
      }
    },
    {
      name: 'Commit to Customer Service',
      description: 'Provide customer centric services in line with public service and organisational objectives',
      behavioralIndicators: {
        'Foundational': [
          'Understands customer needs',
          'Responds promptly to customers',
          'Shows respect and courtesy',
          'Maintains customer confidentiality'
        ],
        'Intermediate': [
          'Takes responsibility for customer outcomes',
          'Identifies and resolves customer issues',
          'Shows initiative in helping customers',
          'Collects customer feedback'
        ],
        'Adept': [
          'Designs customer-focused solutions',
          'Implements service improvements',
          'Maintains service standards',
          'Resolves complex customer issues'
        ],
        'Advanced': [
          'Promotes customer-centric culture',
          'Drives service excellence',
          'Implements customer service strategies',
          'Manages key customer relationships'
        ],
        'Highly Advanced': [
          'Sets customer service vision',
          'Drives customer service transformation',
          'Creates customer-focused systems',
          'Builds strategic partnerships'
        ]
      }
    },
    {
      name: 'Work Collaboratively',
      description: 'Collaborate with others and value their contribution',
      behavioralIndicators: {
        'Foundational': [
          'Works as part of a team',
          'Shares information with others',
          'Supports team members',
          'Respects different working styles'
        ],
        'Intermediate': [
          'Encourages collaboration',
          'Facilitates team discussions',
          'Shares knowledge and resources',
          'Builds positive working relationships'
        ],
        'Adept': [
          'Facilitates cooperation across teams',
          'Drives collaborative outcomes',
          'Resolves team conflicts',
          'Promotes knowledge sharing'
        ],
        'Advanced': [
          'Creates collaborative culture',
          'Builds high-performing teams',
          'Leads cross-functional initiatives',
          'Develops strategic partnerships'
        ],
        'Highly Advanced': [
          'Drives organizational collaboration',
          'Creates collaborative systems',
          'Builds strategic alliances',
          'Leads complex partnerships'
        ]
      }
    },
    {
      name: 'Influence and Negotiate',
      description: 'Gain consensus and commitment from others and resolve issues and conflicts',
      behavioralIndicators: {
        'Foundational': [
          'Presents clear messages',
          'Listens to others\' views',
          'Helps resolve simple conflicts',
          'Shows respect in negotiations'
        ],
        'Intermediate': [
          'Influences others positively',
          'Negotiates effectively',
          'Resolves conflicts',
          'Builds support for ideas'
        ],
        'Adept': [
          'Influences stakeholder outcomes',
          'Leads complex negotiations',
          'Resolves significant conflicts',
          'Builds strategic influence'
        ],
        'Advanced': [
          'Negotiates strategic outcomes',
          'Influences organizational direction',
          'Manages complex stakeholders',
          'Resolves critical issues'
        ],
        'Highly Advanced': [
          'Shapes organizational agenda',
          'Leads strategic negotiations',
          'Influences across sectors',
          'Resolves critical conflicts'
        ]
      }
    }
  ],
  'Results': [
    {
      name: 'Deliver Results',
      description: 'Achieve results through efficient use of resources and a commitment to quality outcomes',
      behavioralIndicators: {
        'Foundational': [
          'Completes work tasks to standard',
          'Uses resources efficiently',
          'Follows direction and procedures',
          'Takes responsibility for work quality'
        ],
        'Intermediate': [
          'Achieves quality outcomes',
          'Plans and organizes work effectively',
          'Monitors own performance',
          'Uses resources responsibly'
        ],
        'Adept': [
          'Drives quality results',
          'Manages resources effectively',
          'Implements performance standards',
          'Achieves business outcomes'
        ],
        'Advanced': [
          'Drives organizational performance',
          'Optimizes resource allocation',
          'Sets high performance standards',
          'Achieves strategic outcomes'
        ],
        'Highly Advanced': [
          'Sets organizational direction',
          'Drives strategic outcomes',
          'Optimizes organizational performance',
          'Creates high-performance culture'
        ]
      }
    },
    {
      name: 'Plan and Prioritise',
      description: 'Plan to achieve priority outcomes and respond flexibly to changing circumstances',
      behavioralIndicators: {
        'Foundational': [
          'Plans daily tasks',
          'Manages time effectively',
          'Adapts to changes',
          'Identifies task priorities'
        ],
        'Intermediate': [
          'Plans team activities',
          'Sets clear priorities',
          'Manages competing demands',
          'Responds to changing needs'
        ],
        'Adept': [
          'Develops project plans',
          'Manages multiple priorities',
          'Implements change effectively',
          'Achieves project outcomes'
        ],
        'Advanced': [
          'Plans strategic initiatives',
          'Manages program priorities',
          'Leads organizational change',
          'Achieves strategic goals'
        ],
        'Highly Advanced': [
          'Sets strategic direction',
          'Drives organizational priorities',
          'Leads major change programs',
          'Achieves transformational outcomes'
        ]
      }
    },
    {
      name: 'Think and Solve Problems',
      description: 'Think, analyse and consider the broader context to develop practical solutions',
      behavioralIndicators: {
        'Foundational': [
          'Identifies simple problems',
          'Gathers relevant information',
          'Suggests practical solutions',
          'Follows problem-solving steps'
        ],
        'Intermediate': [
          'Analyses problems systematically',
          'Evaluates options thoroughly',
          'Implements effective solutions',
          'Learns from outcomes'
        ],
        'Adept': [
          'Solves complex problems',
          'Develops innovative solutions',
          'Uses data effectively',
          'Evaluates outcomes'
        ],
        'Advanced': [
          'Solves strategic problems',
          'Drives innovation',
          'Manages complex analysis',
          'Creates systemic solutions'
        ],
        'Highly Advanced': [
          'Drives strategic problem-solving',
          'Leads organizational innovation',
          'Creates analytical frameworks',
          'Solves critical challenges'
        ]
      }
    },
    {
      name: 'Demonstrate Accountability',
      description: 'Be responsible for own actions, adhere to legislation and policy and be proactive to address risk',
      behavioralIndicators: {
        'Foundational': [
          'Takes responsibility for actions',
          'Follows procedures correctly',
          'Reports issues promptly',
          'Maintains accurate records'
        ],
        'Intermediate': [
          'Ensures team compliance',
          'Manages risks effectively',
          'Takes responsibility for outcomes',
          'Maintains team standards'
        ],
        'Adept': [
          'Drives accountability culture',
          'Manages complex risks',
          'Ensures regulatory compliance',
          'Sets performance standards'
        ],
        'Advanced': [
          'Leads governance frameworks',
          'Manages strategic risks',
          'Ensures organizational compliance',
          'Drives performance culture'
        ],
        'Highly Advanced': [
          'Sets governance direction',
          'Drives risk management culture',
          'Ensures organizational integrity',
          'Creates accountability frameworks'
        ]
      }
    }
  ],
  'Business Enablers': [
    {
      name: 'Finance',
      description: 'Understand and apply financial processes to achieve value for money and minimise financial risk',
      behavioralIndicators: {
        'Foundational': [
          'Understands basic financial concepts',
          'Follows financial procedures',
          'Maintains accurate records',
          'Uses resources responsibly'
        ],
        'Intermediate': [
          'Manages budgets effectively',
          'Monitors financial performance',
          'Identifies cost savings',
          'Ensures financial compliance'
        ],
        'Adept': [
          'Manages complex budgets',
          'Analyzes financial data',
          'Implements financial strategies',
          'Manages financial risks'
        ],
        'Advanced': [
          'Drives financial performance',
          'Develops financial strategies',
          'Manages investment decisions',
          'Ensures financial governance'
        ],
        'Highly Advanced': [
          'Sets financial direction',
          'Drives financial strategy',
          'Manages organizational resources',
          'Creates financial frameworks'
        ]
      }
    },
    {
      name: 'Technology',
      description: 'Understand and use available technologies to maximise efficiencies and effectiveness',
      behavioralIndicators: {
        'Foundational': [
          'Uses basic technology effectively',
          'Follows security procedures',
          'Maintains data accuracy',
          'Adopts new technologies'
        ],
        'Intermediate': [
          'Implements technology solutions',
          'Manages data effectively',
          'Supports digital transformation',
          'Ensures system security'
        ],
        'Adept': [
          'Drives technology adoption',
          'Manages complex systems',
          'Implements digital strategies',
          'Ensures data governance'
        ],
        'Advanced': [
          'Leads digital transformation',
          'Develops technology strategy',
          'Manages enterprise systems',
          'Drives innovation'
        ],
        'Highly Advanced': [
          'Sets technology direction',
          'Drives digital strategy',
          'Creates technology frameworks',
          'Leads technological innovation'
        ]
      }
    },
    {
      name: 'Procurement and Contract Management',
      description: 'Understand and apply procurement processes to ensure effective purchasing and contract performance',
      behavioralIndicators: {
        'Foundational': [
          'Follows procurement procedures',
          'Maintains accurate records',
          'Understands basic contracts',
          'Monitors deliverables'
        ],
        'Intermediate': [
          'Manages simple procurements',
          'Monitors contract performance',
          'Ensures compliance',
          'Manages vendor relationships'
        ],
        'Adept': [
          'Manages complex procurement',
          'Develops contract strategies',
          'Negotiates effectively',
          'Manages vendor performance'
        ],
        'Advanced': [
          'Leads procurement strategy',
          'Manages strategic contracts',
          'Drives value for money',
          'Ensures governance'
        ],
        'Highly Advanced': [
          'Sets procurement direction',
          'Drives strategic sourcing',
          'Creates procurement frameworks',
          'Manages critical partnerships'
        ]
      }
    },
    {
      name: 'Project Management',
      description: 'Understand and apply effective planning, coordination and control methods',
      behavioralIndicators: {
        'Foundational': [
          'Follows project procedures',
          'Maintains project records',
          'Supports project delivery',
          'Reports progress accurately'
        ],
        'Intermediate': [
          'Manages simple projects',
          'Plans effectively',
          'Monitors progress',
          'Manages stakeholders'
        ],
        'Adept': [
          'Manages complex projects',
          'Implements project methodology',
          'Manages project risks',
          'Ensures project outcomes'
        ],
        'Advanced': [
          'Leads major projects',
          'Develops project strategy',
          'Manages program delivery',
          'Drives project excellence'
        ],
        'Highly Advanced': [
          'Sets project direction',
          'Drives program strategy',
          'Creates project frameworks',
          'Leads strategic initiatives'
        ]
      }
    }
  ],
  'People Management': [
    {
      name: 'Manage and Develop People',
      description: 'Engage and motivate staff and develop capability and potential in others',
      behavioralIndicators: {
        'Foundational': [
          'Supports team members',
          'Provides feedback',
          'Shares knowledge',
          'Promotes development'
        ],
        'Intermediate': [
          'Manages team performance',
          'Develops capabilities',
          'Coaches effectively',
          'Builds engagement'
        ],
        'Adept': [
          'Leads team development',
          'Manages performance issues',
          'Builds capability',
          'Drives engagement'
        ],
        'Advanced': [
          'Develops leadership strategy',
          'Builds high-performing teams',
          'Creates development programs',
          'Drives cultural change'
        ],
        'Highly Advanced': [
          'Sets people strategy',
          'Drives talent management',
          'Creates leadership frameworks',
          'Builds organizational capability'
        ]
      }
    },
    {
      name: 'Inspire Direction and Purpose',
      description: 'Communicate goals, priorities and vision and recognise achievements',
      behavioralIndicators: {
        'Foundational': [
          'Shares team goals',
          'Recognizes achievements',
          'Promotes team purpose',
          'Supports team direction'
        ],
        'Intermediate': [
          'Sets clear direction',
          'Motivates others',
          'Communicates vision',
          'Celebrates success'
        ],
        'Adept': [
          'Drives strategic direction',
          'Inspires performance',
          'Creates shared purpose',
          'Builds commitment'
        ],
        'Advanced': [
          'Sets organizational vision',
          'Drives cultural change',
          'Builds strategic alignment',
          'Creates meaningful purpose'
        ],
        'Highly Advanced': [
          'Shapes organizational future',
          'Creates compelling vision',
          'Drives transformational change',
          'Builds lasting legacy'
        ]
      }
    },
    {
      name: 'Optimise Business Outcomes',
      description: 'Manage resources effectively and apply sound workforce planning principles',
      behavioralIndicators: {
        'Foundational': [
          'Uses resources effectively',
          'Follows business processes',
          'Supports efficiency',
          'Maintains standards'
        ],
        'Intermediate': [
          'Manages team resources',
          'Improves processes',
          'Plans workforce needs',
          'Drives efficiency'
        ],
        'Adept': [
          'Optimizes operations',
          'Manages change effectively',
          'Develops workforce plans',
          'Improves performance'
        ],
        'Advanced': [
          'Drives business strategy',
          'Leads organizational change',
          'Optimizes resource allocation',
          'Achieves strategic outcomes'
        ],
        'Highly Advanced': [
          'Sets business direction',
          'Drives organizational strategy',
          'Creates business frameworks',
          'Ensures sustainable outcomes'
        ]
      }
    },
    {
      name: 'Manage Reform and Change',
      description: 'Support, promote and champion change, and assist others to engage with change',
      behavioralIndicators: {
        'Foundational': [
          'Adapts to change',
          'Supports team transitions',
          'Maintains positivity',
          'Follows change processes'
        ],
        'Intermediate': [
          'Implements change initiatives',
          'Manages team transition',
          'Builds change readiness',
          'Addresses resistance'
        ],
        'Adept': [
          'Leads change programs',
          'Manages complex transitions',
          'Builds change capability',
          'Drives engagement'
        ],
        'Advanced': [
          'Drives major reform',
          'Leads cultural transformation',
          'Manages strategic change',
          'Creates change readiness'
        ],
        'Highly Advanced': [
          'Sets reform agenda',
          'Drives transformational change',
          'Creates change frameworks',
          'Builds change leadership'
        ]
      }
    }
  ]
};

function generateCapabilities(institutionId) {
  const capabilities = [];
  const capabilityLevels = [];

  Object.entries(frameworkStructure).forEach(([groupName, groupCapabilities]) => {
    groupCapabilities.forEach(capability => {
      const capabilityId = generateCapabilityId(capability.name, groupName);
      
      capabilities.push({
        id: capabilityId,
        name: capability.name,
        group_name: groupName,
        description: capability.description,
        source_framework: 'NSW Public Sector Capability Framework',
        is_occupation_specific: false,
        company_id: institutionId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Generate levels for this capability
      for (const [level, indicators] of Object.entries(capability.behavioralIndicators)) {
        const levelId = generateLevelId(capabilityId, level);
        capabilityLevels.push({
          id: levelId,
          institution_id: institutionId,
          source_id: 'nswgov',
          external_id: `${capabilityId}_${level.toLowerCase().replace(/\s+/g, '_')}`,
          capability_id: capabilityId,
          level: level,
          summary: `${level} level of ${capability.name}`,
          behavioral_indicators: indicators,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    });
  });

  return { capabilities, capabilityLevels };
}

export async function generateNSWCapabilityData(supabase, institutionId) {
  try {
    logger.info('Checking if NSW Capability Framework data exists...');
    
    // Check if capabilities already exist
    const { data: existingCapabilities, error: checkError } = await supabase
      .from('staging_capabilities')
      .select('count')
      .eq('institution_id', institutionId)
      .eq('source_id', 'nswgov')
      .single();

    if (checkError) {
      logger.error('Error checking existing capabilities:', {
        error: {
          message: checkError.message,
          details: checkError.details,
          hint: checkError.hint,
          code: checkError.code
        }
      });
      throw checkError;
    }

    // If capabilities already exist, skip generation
    if (existingCapabilities?.count > 0) {
      logger.info('NSW Capability Framework data already exists, skipping generation');
      return;
    }

    logger.info('Generating NSW Capability Framework data...');
    const { capabilities, capabilityLevels } = generateCapabilities(institutionId);
    
    // Upsert capabilities
    for (const capability of capabilities) {
      try {
        const { data: capData, error: capError } = await supabase
          .from('staging_capabilities')
          .upsert({
            institution_id: institutionId,
            source_id: 'nswgov',
            external_id: capability.id,
            name: capability.name,
            group_name: capability.group_name,
            description: capability.description,
            source_framework: capability.source_framework,
            is_occupation_specific: capability.is_occupation_specific,
            raw_data: capability,
            processing_status: 'pending'
          }, {
            onConflict: 'institution_id,source_id,external_id',
            returning: true
          });

        if (capError) {
          logger.error('Error upserting capability:', {
            capability: capability.name,
            error: {
              message: capError.message,
              details: capError.details,
              hint: capError.hint,
              code: capError.code
            }
          });
          continue;
        }

        logger.info(`Upserted capability: ${capability.name}`);
      } catch (error) {
        logger.error('Error processing capability:', {
          capability: capability.name,
          error: {
            message: error.message,
            stack: error.stack,
            details: error
          }
        });
        continue;
      }
    }

    // Check if capability levels already exist
    const { data: existingLevels, error: checkLevelsError } = await supabase
      .from('staging_capability_levels')
      .select('count')
      .eq('institution_id', institutionId)
      .eq('source_id', 'nswgov')
      .single();

    if (checkLevelsError) {
      logger.error('Error checking existing capability levels:', {
        error: {
          message: checkLevelsError.message,
          details: checkLevelsError.details,
          hint: checkLevelsError.hint,
          code: checkLevelsError.code
        }
      });
      throw checkLevelsError;
    }

    // If capability levels already exist, skip generation
    if (existingLevels?.count > 0) {
      logger.info('NSW Capability Levels already exist, skipping generation');
      return;
    }

    // Upsert capability levels
    for (const level of capabilityLevels) {
      try {
        const { data: levelData, error: levelError } = await supabase
          .from('staging_capability_levels')
          .upsert({
            id: level.id,
            institution_id: level.institution_id,
            source_id: level.source_id,
            external_id: level.external_id,
            capability_id: level.capability_id,
            level: level.level,
            summary: level.summary,
            behavioral_indicators: level.behavioral_indicators,
            created_at: level.created_at,
            updated_at: level.updated_at,
          }, {
            onConflict: 'id',
            returning: true
          });

        if (levelError) {
          logger.error('Error upserting capability level:', {
            level: level.level,
            capability_id: level.capability_id,
            error: {
              message: levelError.message,
              details: levelError.details,
              hint: levelError.hint,
              code: levelError.code,
              data: level
            }
          });
          continue;
        }

        logger.info(`Upserted capability level: ${level.level} for capability ${level.capability_id}`);
      } catch (error) {
        logger.error('Error processing capability level:', {
          level: level.level,
          capability_id: level.capability_id,
          error: {
            message: error.message,
            stack: error.stack,
            data: level
          }
        });
        continue;
      }
    }
    
    logger.info('NSW Capability Framework data generation completed!');
    return { capabilities, capabilityLevels };
  } catch (error) {
    logger.error('Error generating NSW Capability Framework data:', {
      error: {
        message: error.message,
        stack: error.stack,
        details: error
      }
    });
    throw error;
  }
} 