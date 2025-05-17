openapi: 3.0.0
info:
  title: MCP Action API
  version: 1.0.0
tags:
  - name: Profile
  - name: Role
  - name: Job
  - name: Agent
  - name: Advanced
paths:
  /profiles/{profileId}/context:
    get:
      tags: [Profile]
      summary: Get full profile context
      parameters:
        - name: profileId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200': { description: OK }

  /profiles/{profileId}/career-paths:
    get:
      tags: [Profile]
      summary: Get suggested career paths
      parameters:
        - name: profileId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200': { description: List of CareerPaths }

  /profiles/{profileId}/recommended-jobs:
    get:
      tags: [Profile]
      summary: Get recommended jobs
      parameters:
        - name: profileId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200': { description: List of Jobs }

  /profiles/{profileId}/capability-gaps/{targetRoleId}:
    get:
      tags: [Profile]
      summary: Get capability gap between profile and role
      parameters:
        - name: profileId
          in: path
          required: true
          schema:
            type: string
        - name: targetRoleId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200': { description: Capability comparison }

  /roles/{roleId}/matching-profiles:
    get:
      tags: [Role]
      summary: Get matching profiles for role
      parameters:
        - name: roleId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200': { description: List of matched profiles }

  /roles/{roleId}/career-paths/from:
    get:
      tags: [Role]
      summary: Get outbound career paths from this role
      parameters:
        - name: roleId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200': { description: List of paths }

  /jobs/{jobId}/readiness/{profileId}:
    get:
      tags: [Job]
      summary: Assess profile's job readiness
      parameters:
        - name: jobId
          in: path
          required: true
          schema:
            type: string
        - name: profileId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200': { description: Readiness score }

  /agents/score-profile-fit:
    post:
      tags: [Agent]
      summary: Score profile fit to a role
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                profileId:
                  type: string
                roleId:
                  type: string
      responses:
        '200': { description: Fit score and explanation }

  /agents/log-action:
    post:
      tags: [Agent]
      summary: Log an agent action
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                agentName:
                  type: string
                actionType:
                  type: string
                targetType:
                  type: string
                targetId:
                  type: string
                payload:
                  type: object
                timestamp:
                  type: string
                  format: date-time
      responses:
        '200': { description: Action logged }

  /advanced/compare-profiles:
    post:
      tags: [Advanced]
      summary: Compare two profiles
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                profileA:
                  type: string
                profileB:
                  type: string
      responses:
        '200': { description: Comparison output }
