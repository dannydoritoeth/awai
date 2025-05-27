'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getRoleTransitions, getRole } from '@/lib/services/data';
import Link from 'next/link';
import type { Role, Transition, Capability, Skill } from '@/lib/services/data';

interface PageProps {
  params: {
    source_id: string;
    target_id: string;
  };
}

interface TransitionDetails extends Transition {
  capabilityGaps: {
    capability: Capability;
    currentLevel: string;
    requiredLevel: string;
    gap: number;
  }[];
  skillGaps: {
    skill: Skill;
    status: 'missing' | 'needs-improvement' | 'adequate';
  }[];
  developmentActions: {
    type: string;
    description: string;
    timeframe: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  alternativePathways: {
    path: Role[];
    difficulty: number;
    timeframe: string;
  }[];
}

export default function TransitionPage({ params }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceRole, setSourceRole] = useState<Role | null>(null);
  const [targetRole, setTargetRole] = useState<Role | null>(null);
  const [transitionDetails, setTransitionDetails] = useState<TransitionDetails | null>(null);

  useEffect(() => {
    const loadTransitionData = async () => {
      try {
        // Load source and target roles
        const [sourceResponse, targetResponse] = await Promise.all([
          getRole(params.source_id),
          getRole(params.target_id)
        ]);

        if (sourceResponse.success && targetResponse.success) {
          setSourceRole(sourceResponse.data);
          setTargetRole(targetResponse.data);

          // TODO: Replace with actual transition details service call
          const mockTransitionDetails: TransitionDetails = {
            id: `${params.source_id}-${params.target_id}`,
            from_role: sourceResponse.data!,
            to_role: targetResponse.data!,
            transition_type: {
              id: '1',
              name: 'Career Progression',
              description: 'Natural career advancement path'
            },
            frequency: 15,
            success_rate: 0.75,
            avg_time_months: 18,
            capabilityGaps: [
              {
                capability: {
                  id: '1',
                  name: 'Strategic Planning',
                  group_name: 'Leadership',
                  description: 'Ability to develop and execute strategies',
                  type: 'Core',
                  level: 'Advanced'
                },
                currentLevel: 'Intermediate',
                requiredLevel: 'Advanced',
                gap: 1
              },
              {
                capability: {
                  id: '2',
                  name: 'People Management',
                  group_name: 'Leadership',
                  description: 'Ability to lead and develop teams',
                  type: 'Core',
                  level: 'Expert'
                },
                currentLevel: 'Advanced',
                requiredLevel: 'Expert',
                gap: 1
              }
            ],
            skillGaps: [
              {
                skill: {
                  id: '1',
                  name: 'Stakeholder Management',
                  category: 'Soft Skills',
                  description: 'Managing relationships with stakeholders'
                },
                status: 'needs-improvement'
              },
              {
                skill: {
                  id: '2',
                  name: 'Budget Management',
                  category: 'Technical Skills',
                  description: 'Managing departmental budgets'
                },
                status: 'missing'
              }
            ],
            developmentActions: [
              {
                type: 'Training',
                description: 'Complete Advanced Strategic Planning certification',
                timeframe: '6 months',
                priority: 'high'
              },
              {
                type: 'Experience',
                description: 'Lead a cross-functional strategic initiative',
                timeframe: '12 months',
                priority: 'high'
              },
              {
                type: 'Mentoring',
                description: 'Find a mentor in target role',
                timeframe: '1 month',
                priority: 'medium'
              }
            ],
            alternativePathways: [
              {
                path: [sourceResponse.data!, targetResponse.data!],
                difficulty: 0.7,
                timeframe: '18-24 months'
              },
              {
                path: [
                  sourceResponse.data!,
                  {
                    ...sourceResponse.data!,
                    id: 'intermediate',
                    title: 'Intermediate Role'
                  },
                  targetResponse.data!
                ],
                difficulty: 0.5,
                timeframe: '24-30 months'
              }
            ]
          };

          setTransitionDetails(mockTransitionDetails);
        } else {
          setError('Failed to load role details');
        }
      } catch (error) {
        setError('Failed to load transition data');
      } finally {
        setLoading(false);
      }
    };

    loadTransitionData();
  }, [params.source_id, params.target_id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!sourceRole || !targetRole || !transitionDetails) {
    return <div>Transition details not found</div>;
  }

  const readinessScore = Math.round((1 - transitionDetails.capabilityGaps.length / 5) * 100);

  return (
    <div className="container mx-auto py-8">
      {/* Transition Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Role Transition Analysis</h1>
        <div className="flex items-center gap-4 text-lg">
          <Link href={`/roles/${sourceRole.id}`} className="text-blue-600 hover:underline">
            {sourceRole.title}
          </Link>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <Link href={`/roles/${targetRole.id}`} className="text-blue-600 hover:underline">
            {targetRole.title}
          </Link>
        </div>
      </div>

      {/* Readiness Score */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Transition Readiness</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span>Overall Readiness Score</span>
                  <span className="font-semibold">{readinessScore}%</span>
                </div>
                <Progress value={readinessScore} className="h-2" />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Success Rate</p>
                  <p className="text-2xl font-semibold">{Math.round(transitionDetails.success_rate * 100)}%</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Average Time</p>
                  <p className="text-2xl font-semibold">{transitionDetails.avg_time_months} months</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Frequency</p>
                  <p className="text-2xl font-semibold">{transitionDetails.frequency} transitions</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gap Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Capability Gaps */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Capability Gaps</h2>
            <div className="space-y-4">
              {transitionDetails.capabilityGaps.map((gap) => (
                <div key={gap.capability.id} className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">{gap.capability.name}</h3>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Current: {gap.currentLevel}</span>
                    <span>Required: {gap.requiredLevel}</span>
                  </div>
                  <Progress value={((4 - gap.gap) / 4) * 100} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Skill Gaps */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Skill Gaps</h2>
            <div className="space-y-4">
              {transitionDetails.skillGaps.map((gap) => (
                <div key={gap.skill.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{gap.skill.name}</h3>
                      <p className="text-sm text-gray-600">{gap.skill.category}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      gap.status === 'missing' ? 'bg-red-100 text-red-800' :
                      gap.status === 'needs-improvement' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {gap.status.replace('-', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Development Actions */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Development Actions</h2>
            <div className="space-y-4">
              {transitionDetails.developmentActions.map((action, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{action.type}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      action.priority === 'high' ? 'bg-red-100 text-red-800' :
                      action.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {action.priority} priority
                    </span>
                  </div>
                  <p className="text-gray-600 mb-2">{action.description}</p>
                  <p className="text-sm text-gray-500">Timeframe: {action.timeframe}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alternative Pathways */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Alternative Pathways</h2>
          <div className="space-y-6">
            {transitionDetails.alternativePathways.map((pathway, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  {pathway.path.map((role, roleIndex) => (
                    <div key={role.id} className="flex items-center">
                      <div className="text-blue-600">
                        {role.title}
                      </div>
                      {roleIndex < pathway.path.length - 1 && (
                        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Difficulty: {Math.round(pathway.difficulty * 100)}%</span>
                  <span>Estimated timeframe: {pathway.timeframe}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 