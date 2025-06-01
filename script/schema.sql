


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."ai_invocation_status" AS ENUM (
    'success',
    'error',
    'timeout'
);


ALTER TYPE "public"."ai_invocation_status" OWNER TO "postgres";


CREATE TYPE "public"."ai_model_provider" AS ENUM (
    'openai',
    'google',
    'anthropic'
);


ALTER TYPE "public"."ai_model_provider" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_job"("p_job_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update jobs table
    UPDATE jobs 
    SET 
        is_archived = true,
        last_updated_at = NOW()
    WHERE id = p_job_id;

    -- Create history record
    INSERT INTO jobs_history (
        id, 
        version,
        institution_id,
        company_id,
        division_id,
        source_id,
        original_id,
        external_id,
        title,
        description,
        open_date,
        close_date,
        department,
        department_id,
        job_type,
        source_url,
        remuneration,
        recruiter,
        locations,
        raw_json,
        changed_fields,
        change_type,
        change_reason,
        created_by
    )
    SELECT 
        id,
        version + 1,
        institution_id,
        company_id,
        division_id,
        source_id,
        original_id,
        external_id,
        title,
        description,
        open_date,
        close_date,
        department,
        department_id,
        job_type,
        source_url,
        remuneration,
        recruiter,
        locations,
        to_jsonb(jobs.*) as raw_json,
        ARRAY['is_archived'] as changed_fields,
        'archive' as change_type,
        p_reason as change_reason,
        'system' as created_by
    FROM jobs
    WHERE id = p_job_id;
END;
$$;


ALTER FUNCTION "public"."archive_job"("p_job_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."execute_sql"("sql" "text", "params" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result jsonb;
BEGIN
  -- Security checks
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles 
    WHERE rolname = current_user 
    AND rolsuper
  ) THEN
    -- Only allow SELECT queries
    IF NOT (lower(sql) LIKE 'select%') THEN
      RAISE EXCEPTION 'Only SELECT queries are allowed';
    END IF;

    -- Prevent writes
    IF lower(sql) LIKE '%insert%' OR 
       lower(sql) LIKE '%update%' OR 
       lower(sql) LIKE '%delete%' OR 
       lower(sql) LIKE '%drop%' OR 
       lower(sql) LIKE '%truncate%' OR 
       lower(sql) LIKE '%alter%' THEN
      RAISE EXCEPTION 'Write operations are not allowed';
    END IF;
  END IF;

  -- Execute the query with parameters
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', sql) 
  USING params
  INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."execute_sql"("sql" "text", "params" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_embeddings_by_id"("p_query_id" "uuid", "p_table_name" "text", "p_match_threshold" double precision, "p_match_count" integer) RETURNS TABLE("id" "uuid", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- Get the embedding for the query ID
  EXECUTE format(
    'SELECT embedding FROM %I WHERE id = $1',
    p_table_name
  ) USING p_query_id INTO query_embedding;

  IF query_embedding IS NULL THEN
    RAISE EXCEPTION 'No embedding found for ID % in table %', p_query_id, p_table_name;
  END IF;

  -- Use the embedding to find matches
  RETURN QUERY EXECUTE format(
    'SELECT id, 1 - (embedding <=> $1) as similarity
     FROM %I
     WHERE id != $2 AND 1 - (embedding <=> $1) > $3
     ORDER BY similarity DESC
     LIMIT $4',
    p_table_name
  ) USING query_embedding, p_query_id, p_match_threshold, p_match_count;
END;
$_$;


ALTER FUNCTION "public"."match_embeddings_by_id"("p_query_id" "uuid", "p_table_name" "text", "p_match_threshold" double precision, "p_match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_embeddings_by_vector"("p_query_embedding" "extensions"."vector", "p_table_name" "text", "p_match_threshold" double precision, "p_match_count" integer) RETURNS TABLE("id" "uuid", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT id, 1 - (embedding <=> $1) as similarity
     FROM %I
     WHERE 1 - (embedding <=> $1) > $2
     ORDER BY similarity DESC
     LIMIT $3',
    p_table_name
  ) USING p_query_embedding, p_match_threshold, p_match_count;
END;
$_$;


ALTER FUNCTION "public"."match_embeddings_by_vector"("p_query_embedding" "extensions"."vector", "p_table_name" "text", "p_match_threshold" double precision, "p_match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_job_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.version := OLD.version + 1;
    NEW.last_updated_at := NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_job_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agent_actions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "agent_name" "text",
    "action_type" "text",
    "target_type" "text",
    "target_id" "uuid",
    "outcome" "text",
    "confidence_score" numeric,
    "session_id" "uuid",
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "company_id" "uuid",
    "embedding" "extensions"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "request" "jsonb",
    "request_hash" "text",
    "step_index" integer,
    "response" "jsonb",
    "user_id" "uuid"
);


ALTER TABLE "public"."agent_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_model_invocations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid",
    "action_type" "text",
    "model_provider" "public"."ai_model_provider" NOT NULL,
    "model_name" "text" NOT NULL,
    "temperature" numeric,
    "max_tokens" integer,
    "system_prompt" "text",
    "user_prompt" "text",
    "messages" "jsonb",
    "other_params" "jsonb",
    "response_text" "text",
    "response_metadata" "jsonb",
    "token_usage" "jsonb",
    "status" "public"."ai_invocation_status" NOT NULL,
    "error_message" "text",
    "latency_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_temperature" CHECK ((("temperature" >= (0)::numeric) AND ("temperature" <= (1)::numeric)))
);


ALTER TABLE "public"."ai_model_invocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."capabilities" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "group_name" "text",
    "description" "text",
    "source_framework" "text",
    "is_occupation_specific" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "extensions"."vector"(1536),
    "company_id" "uuid",
    "embedding_text_hash" "text",
    "sync_status" "text",
    "last_synced_at" timestamp with time zone,
    "normalized_key" "text"
);


ALTER TABLE "public"."capabilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."capability_levels" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "capability_id" "uuid",
    "level" "text",
    "summary" "text",
    "behavioral_indicators" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sync_status" "text",
    "last_synced_at" timestamp with time zone
);


ALTER TABLE "public"."capability_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."career_paths" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "source_role_id" "uuid",
    "target_role_id" "uuid",
    "path_type" "text",
    "recommended_by" "text",
    "supporting_evidence" "text"[],
    "popularity_score" numeric,
    "skill_gap_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "company_id" "uuid"
);


ALTER TABLE "public"."career_paths" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "sender" "text",
    "message" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "embedding" "extensions"."vector"(1536),
    "user_id" "uuid",
    "company_id" "uuid",
    CONSTRAINT "chat_messages_sender_check" CHECK (("sender" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "website" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "extensions"."vector"(1536),
    "embedding_text_hash" "text",
    "institution_id" "uuid",
    "parent_company_id" "uuid",
    "slug" "text",
    "sync_status" "text",
    "last_synced_at" timestamp with time zone,
    "raw_data" "jsonb"
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "summary" "text",
    "mode" "text",
    "entity_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "browser_session_id" "text",
    "user_id" "uuid",
    "company_id" "uuid",
    CONSTRAINT "check_entity_id_required" CHECK (((("mode" = 'general'::"text") AND ("entity_id" IS NULL)) OR (("mode" <> 'general'::"text") AND ("entity_id" IS NOT NULL)))),
    CONSTRAINT "conversation_sessions_mode_check" CHECK (("mode" = ANY (ARRAY['candidate'::"text", 'hiring'::"text", 'general'::"text", 'analyst'::"text"])))
);

ALTER TABLE ONLY "public"."conversation_sessions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."conversation_sessions"."mode" IS 'Valid values: candidate, hiring, general, analyst';



CREATE TABLE IF NOT EXISTS "public"."divisions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid",
    "name" "text" NOT NULL,
    "cluster" "text",
    "agency" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "extensions"."vector"(1536),
    "embedding_text_hash" "text",
    "slug" "text",
    "sync_status" "text",
    "last_synced_at" timestamp with time zone,
    "raw_data" "jsonb"
);


ALTER TABLE "public"."divisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."general_role_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."general_role_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."general_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "function_area" "text" NOT NULL,
    "classification_level" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "embedding" "extensions"."vector"(1536)
);


ALTER TABLE "public"."general_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "logo_url" "text",
    "website_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "raw_data" "jsonb"
);


ALTER TABLE "public"."institutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_documents" (
    "job_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "document_url" "text",
    "document_type" "text",
    "title" "text",
    "url" "text",
    "sync_status" "text",
    "last_synced_at" timestamp with time zone
);


ALTER TABLE "public"."job_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_skills" (
    "job_id" "uuid" NOT NULL,
    "skill_id" "uuid" NOT NULL
);


ALTER TABLE "public"."job_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "role_id" "uuid",
    "title" "text" NOT NULL,
    "open_date" "date",
    "close_date" "date",
    "department" "text",
    "department_id" "text",
    "job_type" "text",
    "external_id" "text",
    "source_url" "text",
    "remuneration" "text",
    "recruiter" "jsonb",
    "locations" "text"[],
    "raw_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "extensions"."vector"(1536),
    "company_id" "uuid",
    "embedding_text_hash" "text",
    "source_id" "text",
    "original_id" "text",
    "version" integer DEFAULT 1,
    "first_seen_at" timestamp without time zone DEFAULT "now"(),
    "last_updated_at" timestamp without time zone DEFAULT "now"(),
    "sync_status" "text",
    "last_synced_at" timestamp with time zone,
    "raw_data" "jsonb"
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs_history" (
    "id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "division_id" "uuid",
    "source_id" "text" NOT NULL,
    "original_id" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "open_date" "date",
    "close_date" "date",
    "department" "text",
    "department_id" "text",
    "job_type" "text",
    "source_url" "text",
    "remuneration" "text",
    "recruiter" "jsonb",
    "locations" "text"[],
    "raw_json" "jsonb",
    "changed_fields" "text"[],
    "change_type" "text" NOT NULL,
    "change_reason" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."jobs_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_agent_actions" (
    "profile_id" "uuid" NOT NULL,
    "action_id" "uuid" NOT NULL
);


ALTER TABLE "public"."profile_agent_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_capabilities" (
    "profile_id" "uuid" NOT NULL,
    "capability_id" "uuid" NOT NULL,
    "level" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_capabilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_career_paths" (
    "profile_id" "uuid" NOT NULL,
    "career_path_id" "uuid" NOT NULL
);


ALTER TABLE "public"."profile_career_paths" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_job_interactions" (
    "profile_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "interaction_type" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_job_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_skills" (
    "profile_id" "uuid" NOT NULL,
    "skill_id" "uuid" NOT NULL,
    "rating" "text",
    "evidence" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text",
    "email" "text",
    "role_title" "text",
    "division" "text",
    "last_active" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "extensions"."vector"(1536),
    "company_id" "uuid",
    "embedding_text_hash" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_capabilities" (
    "role_id" "uuid" NOT NULL,
    "capability_id" "uuid" NOT NULL,
    "capability_type" "text" NOT NULL,
    "level" "text",
    "sync_status" "text",
    "last_synced_at" timestamp with time zone
);


ALTER TABLE "public"."role_capabilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_documents" (
    "role_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "document_url" "text",
    "document_type" "text",
    "title" "text"
);


ALTER TABLE "public"."role_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_skills" (
    "role_id" "uuid" NOT NULL,
    "skill_id" "uuid" NOT NULL,
    "sync_status" "text",
    "last_synced_at" timestamp with time zone
);


ALTER TABLE "public"."role_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_taxonomies" (
    "role_id" "uuid" NOT NULL,
    "taxonomy_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sync_status" "text",
    "last_synced_at" timestamp with time zone
);


ALTER TABLE "public"."role_taxonomies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "division_id" "uuid",
    "grade_band" "text",
    "location" "text",
    "anzsco_code" "text",
    "pcat_code" "text",
    "date_approved" "date",
    "primary_purpose" "text",
    "reporting_line" "text",
    "direct_reports" "text",
    "budget_responsibility" "text",
    "source_document_url" "text",
    "raw_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "extensions"."vector"(1536),
    "company_id" "uuid",
    "embedding_text_hash" "text",
    "sync_status" "text",
    "last_synced_at" timestamp with time zone,
    "normalized_key" "text",
    "raw_data" "jsonb"
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skills" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "description" "text",
    "source" "text",
    "is_occupation_specific" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "extensions"."vector"(1536),
    "company_id" "uuid",
    "embedding_text_hash" "text",
    "sync_status" "text",
    "last_synced_at" timestamp with time zone
);


ALTER TABLE "public"."skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."taxonomy" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "taxonomy_type" "text" DEFAULT 'core'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."taxonomy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "role" "text",
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_login_at" timestamp with time zone,
    "metadata" "jsonb"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agent_actions"
    ADD CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_model_invocations"
    ADD CONSTRAINT "ai_model_invocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capabilities"
    ADD CONSTRAINT "capabilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capabilities"
    ADD CONSTRAINT "capabilities_unique_key" UNIQUE ("normalized_key", "company_id");



ALTER TABLE ONLY "public"."capability_levels"
    ADD CONSTRAINT "capability_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capability_levels"
    ADD CONSTRAINT "capability_levels_unique_external" UNIQUE ("capability_id", "level");



ALTER TABLE ONLY "public"."career_paths"
    ADD CONSTRAINT "career_paths_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_unique_external" UNIQUE ("institution_id", "slug");



ALTER TABLE ONLY "public"."conversation_sessions"
    ADD CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."divisions"
    ADD CONSTRAINT "divisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."divisions"
    ADD CONSTRAINT "divisions_unique_external" UNIQUE ("company_id", "slug");



ALTER TABLE ONLY "public"."job_documents"
    ADD CONSTRAINT "documents_unique_external" UNIQUE ("job_id", "url");



ALTER TABLE ONLY "public"."general_role_types"
    ADD CONSTRAINT "general_role_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."general_role_types"
    ADD CONSTRAINT "general_role_types_type_category_key" UNIQUE ("type", "category");



ALTER TABLE ONLY "public"."general_roles"
    ADD CONSTRAINT "general_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."job_documents"
    ADD CONSTRAINT "job_documents_pkey" PRIMARY KEY ("job_id", "document_id");



ALTER TABLE ONLY "public"."job_skills"
    ADD CONSTRAINT "job_skills_pkey" PRIMARY KEY ("job_id", "skill_id");



ALTER TABLE ONLY "public"."jobs_history"
    ADD CONSTRAINT "jobs_history_pkey" PRIMARY KEY ("id", "version");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_institution_source_original_unique" UNIQUE ("company_id", "source_id", "original_id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_unique_external" UNIQUE ("company_id", "source_id", "original_id");



ALTER TABLE ONLY "public"."profile_agent_actions"
    ADD CONSTRAINT "profile_agent_actions_pkey" PRIMARY KEY ("profile_id", "action_id");



ALTER TABLE ONLY "public"."profile_capabilities"
    ADD CONSTRAINT "profile_capabilities_pkey" PRIMARY KEY ("profile_id", "capability_id");



ALTER TABLE ONLY "public"."profile_career_paths"
    ADD CONSTRAINT "profile_career_paths_pkey" PRIMARY KEY ("profile_id", "career_path_id");



ALTER TABLE ONLY "public"."profile_job_interactions"
    ADD CONSTRAINT "profile_job_interactions_pkey" PRIMARY KEY ("profile_id", "job_id", "interaction_type");



ALTER TABLE ONLY "public"."profile_skills"
    ADD CONSTRAINT "profile_skills_pkey" PRIMARY KEY ("profile_id", "skill_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_capabilities"
    ADD CONSTRAINT "role_capabilities_pkey" PRIMARY KEY ("role_id", "capability_id", "capability_type");



ALTER TABLE ONLY "public"."role_capabilities"
    ADD CONSTRAINT "role_capabilities_unique_external" UNIQUE ("role_id", "capability_id");



ALTER TABLE ONLY "public"."role_documents"
    ADD CONSTRAINT "role_documents_pkey" PRIMARY KEY ("role_id", "document_id");



ALTER TABLE ONLY "public"."role_skills"
    ADD CONSTRAINT "role_skills_pkey" PRIMARY KEY ("role_id", "skill_id");



ALTER TABLE ONLY "public"."role_skills"
    ADD CONSTRAINT "role_skills_unique_external" UNIQUE ("role_id", "skill_id");



ALTER TABLE ONLY "public"."role_taxonomies"
    ADD CONSTRAINT "role_taxonomies_pkey" PRIMARY KEY ("role_id", "taxonomy_id");



ALTER TABLE ONLY "public"."role_taxonomies"
    ADD CONSTRAINT "role_taxonomies_unique_external" UNIQUE ("role_id", "taxonomy_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_unique_key" UNIQUE ("normalized_key", "company_id");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxonomy"
    ADD CONSTRAINT "taxonomy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "agent_actions_embedding_idx" ON "public"."agent_actions" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "capabilities_embedding_idx" ON "public"."capabilities" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "companies_embedding_idx" ON "public"."companies" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "divisions_embedding_idx" ON "public"."divisions" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "general_roles_embedding_idx" ON "public"."general_roles" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "idx_agent_actions_request_hash" ON "public"."agent_actions" USING "btree" ("request_hash");



CREATE INDEX "idx_agent_actions_session_step" ON "public"."agent_actions" USING "btree" ("session_id", "step_index");



CREATE INDEX "idx_ai_invocations_action" ON "public"."ai_model_invocations" USING "btree" ("action_type");



CREATE INDEX "idx_ai_invocations_created" ON "public"."ai_model_invocations" USING "btree" ("created_at");



CREATE INDEX "idx_ai_invocations_session" ON "public"."ai_model_invocations" USING "btree" ("session_id");



CREATE INDEX "idx_ai_invocations_status" ON "public"."ai_model_invocations" USING "btree" ("status");



CREATE INDEX "idx_capabilities_embedding_hash" ON "public"."capabilities" USING "btree" ("embedding_text_hash");



CREATE INDEX "idx_capabilities_group" ON "public"."capabilities" USING "btree" ("group_name");



COMMENT ON INDEX "public"."idx_capabilities_group" IS 'Improves performance of capability group filtering';



CREATE INDEX "idx_career_paths_popularity" ON "public"."career_paths" USING "btree" ("popularity_score" DESC);



COMMENT ON INDEX "public"."idx_career_paths_popularity" IS 'Improves performance of popular career path queries';



CREATE INDEX "idx_career_paths_target_role" ON "public"."career_paths" USING "btree" ("target_role_id");



COMMENT ON INDEX "public"."idx_career_paths_target_role" IS 'Improves performance of career path destination queries';



CREATE INDEX "idx_chat_messages_session" ON "public"."chat_messages" USING "btree" ("session_id");



CREATE INDEX "idx_chat_messages_timestamp" ON "public"."chat_messages" USING "btree" ("timestamp");



CREATE INDEX "idx_companies_embedding_hash" ON "public"."companies" USING "btree" ("embedding_text_hash");



CREATE INDEX "idx_companies_institution_id" ON "public"."companies" USING "btree" ("institution_id");



CREATE INDEX "idx_conversation_sessions_browser_session" ON "public"."conversation_sessions" USING "btree" ("browser_session_id");



CREATE INDEX "idx_conversation_sessions_entity" ON "public"."conversation_sessions" USING "btree" ("entity_id");



CREATE INDEX "idx_conversation_sessions_mode" ON "public"."conversation_sessions" USING "btree" ("mode");



CREATE INDEX "idx_conversation_sessions_profile" ON "public"."conversation_sessions" USING "btree" ("profile_id");



CREATE INDEX "idx_divisions_embedding_hash" ON "public"."divisions" USING "btree" ("embedding_text_hash");



CREATE INDEX "idx_jobs_embedding_hash" ON "public"."jobs" USING "btree" ("embedding_text_hash");



CREATE INDEX "idx_jobs_history_created_at" ON "public"."jobs_history" USING "btree" ("created_at");



CREATE INDEX "idx_jobs_history_id_version" ON "public"."jobs_history" USING "btree" ("id", "version" DESC);



CREATE INDEX "idx_profile_capabilities_level" ON "public"."profile_capabilities" USING "btree" ("level");



COMMENT ON INDEX "public"."idx_profile_capabilities_level" IS 'Improves performance of capability level filtering';



CREATE INDEX "idx_profile_job_interactions_profile_timestamp" ON "public"."profile_job_interactions" USING "btree" ("profile_id", "timestamp" DESC);



COMMENT ON INDEX "public"."idx_profile_job_interactions_profile_timestamp" IS 'Improves performance of recent job interaction queries';



CREATE INDEX "idx_profile_job_interactions_type_timestamp" ON "public"."profile_job_interactions" USING "btree" ("interaction_type", "timestamp" DESC);



COMMENT ON INDEX "public"."idx_profile_job_interactions_type_timestamp" IS 'Improves performance of interaction type filtering';



CREATE INDEX "idx_profile_skills_profile_skill" ON "public"."profile_skills" USING "btree" ("profile_id", "skill_id");



COMMENT ON INDEX "public"."idx_profile_skills_profile_skill" IS 'Improves performance of profile skill lookups and joins';



CREATE INDEX "idx_profile_skills_rating" ON "public"."profile_skills" USING "btree" ("rating");



COMMENT ON INDEX "public"."idx_profile_skills_rating" IS 'Improves performance of skill level filtering';



CREATE INDEX "idx_profiles_embedding_hash" ON "public"."profiles" USING "btree" ("embedding_text_hash");



CREATE INDEX "idx_role_capabilities_level" ON "public"."role_capabilities" USING "btree" ("level");



COMMENT ON INDEX "public"."idx_role_capabilities_level" IS 'Improves performance of capability level matching';



CREATE INDEX "idx_role_capabilities_type" ON "public"."role_capabilities" USING "btree" ("capability_type");



COMMENT ON INDEX "public"."idx_role_capabilities_type" IS 'Improves performance of capability type filtering';



CREATE INDEX "idx_role_skills_role_skill" ON "public"."role_skills" USING "btree" ("role_id", "skill_id");



COMMENT ON INDEX "public"."idx_role_skills_role_skill" IS 'Improves performance of role skill lookups and joins';



CREATE INDEX "idx_role_taxonomies_role_id" ON "public"."role_taxonomies" USING "btree" ("role_id");



CREATE INDEX "idx_role_taxonomies_taxonomy_id" ON "public"."role_taxonomies" USING "btree" ("taxonomy_id");



CREATE INDEX "idx_roles_embedding_hash" ON "public"."roles" USING "btree" ("embedding_text_hash");



CREATE INDEX "idx_skills_category" ON "public"."skills" USING "btree" ("category");



COMMENT ON INDEX "public"."idx_skills_category" IS 'Improves performance of skill category filtering';



CREATE INDEX "idx_skills_embedding_hash" ON "public"."skills" USING "btree" ("embedding_text_hash");



CREATE INDEX "idx_taxonomy_name" ON "public"."taxonomy" USING "btree" ("name");



CREATE INDEX "idx_taxonomy_type" ON "public"."taxonomy" USING "btree" ("taxonomy_type");



CREATE INDEX "jobs_embedding_idx" ON "public"."jobs" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "profiles_embedding_idx" ON "public"."profiles" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "roles_embedding_idx" ON "public"."roles" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "skills_embedding_idx" ON "public"."skills" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops");



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."agent_actions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."capabilities" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."capability_levels" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."career_paths" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."divisions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."job_documents" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."job_skills" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."profile_agent_actions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."profile_capabilities" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."profile_career_paths" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."profile_job_interactions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."profile_skills" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."role_capabilities" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."role_documents" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."role_skills" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."skills" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "tr_update_job_version" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_job_version"();



ALTER TABLE ONLY "public"."agent_actions"
    ADD CONSTRAINT "agent_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ai_model_invocations"
    ADD CONSTRAINT "ai_model_invocations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id");



ALTER TABLE ONLY "public"."capabilities"
    ADD CONSTRAINT "capabilities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."capability_levels"
    ADD CONSTRAINT "capability_levels_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id");



ALTER TABLE ONLY "public"."career_paths"
    ADD CONSTRAINT "career_paths_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."career_paths"
    ADD CONSTRAINT "career_paths_source_role_id_fkey" FOREIGN KEY ("source_role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."career_paths"
    ADD CONSTRAINT "career_paths_target_role_id_fkey" FOREIGN KEY ("target_role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_parent_company_id_fkey" FOREIGN KEY ("parent_company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."conversation_sessions"
    ADD CONSTRAINT "conversation_sessions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."divisions"
    ADD CONSTRAINT "divisions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "fk_chat_messages_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "fk_chat_messages_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversation_sessions"
    ADD CONSTRAINT "fk_conversation_sessions_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversation_sessions"
    ADD CONSTRAINT "fk_conversation_sessions_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversation_sessions"
    ADD CONSTRAINT "fk_profile" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "fk_session" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_documents"
    ADD CONSTRAINT "job_documents_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."job_skills"
    ADD CONSTRAINT "job_skills_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."job_skills"
    ADD CONSTRAINT "job_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."profile_agent_actions"
    ADD CONSTRAINT "profile_agent_actions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."agent_actions"("id");



ALTER TABLE ONLY "public"."profile_agent_actions"
    ADD CONSTRAINT "profile_agent_actions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profile_capabilities"
    ADD CONSTRAINT "profile_capabilities_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id");



ALTER TABLE ONLY "public"."profile_capabilities"
    ADD CONSTRAINT "profile_capabilities_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profile_career_paths"
    ADD CONSTRAINT "profile_career_paths_career_path_id_fkey" FOREIGN KEY ("career_path_id") REFERENCES "public"."career_paths"("id");



ALTER TABLE ONLY "public"."profile_career_paths"
    ADD CONSTRAINT "profile_career_paths_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profile_job_interactions"
    ADD CONSTRAINT "profile_job_interactions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."profile_job_interactions"
    ADD CONSTRAINT "profile_job_interactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profile_skills"
    ADD CONSTRAINT "profile_skills_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profile_skills"
    ADD CONSTRAINT "profile_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id");



ALTER TABLE ONLY "public"."role_capabilities"
    ADD CONSTRAINT "role_capabilities_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id");



ALTER TABLE ONLY "public"."role_capabilities"
    ADD CONSTRAINT "role_capabilities_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."role_documents"
    ADD CONSTRAINT "role_documents_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."role_skills"
    ADD CONSTRAINT "role_skills_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."role_skills"
    ADD CONSTRAINT "role_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id");



ALTER TABLE ONLY "public"."role_taxonomies"
    ADD CONSTRAINT "role_taxonomies_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_taxonomies"
    ADD CONSTRAINT "role_taxonomies_taxonomy_id_fkey" FOREIGN KEY ("taxonomy_id") REFERENCES "public"."taxonomy"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



CREATE POLICY "Allow authenticated insert" ON "public"."general_roles" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated update" ON "public"."general_roles" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow insert access to service role" ON "public"."ai_model_invocations" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Allow public read access" ON "public"."general_roles" FOR SELECT USING (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."ai_model_invocations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service role has full access to conversation sessions" ON "public"."conversation_sessions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Users can create conversation sessions" ON "public"."conversation_sessions" FOR INSERT WITH CHECK ((("browser_session_id" IS NOT NULL) OR (("auth"."uid"() IS NOT NULL) AND ("profile_id" = "auth"."uid"()))));



CREATE POLICY "Users can create messages in their browser sessions" ON "public"."chat_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversation_sessions"
  WHERE (("conversation_sessions"."id" = "chat_messages"."session_id") AND (("conversation_sessions"."browser_session_id" IS NOT NULL) OR (("auth"."uid"() IS NOT NULL) AND ("conversation_sessions"."profile_id" = "auth"."uid"())))))));



CREATE POLICY "Users can create their own conversation sessions" ON "public"."conversation_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "Users can insert messages in their sessions" ON "public"."chat_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversation_sessions"
  WHERE (("conversation_sessions"."id" = "chat_messages"."session_id") AND ("conversation_sessions"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Users can view messages in their browser sessions" ON "public"."chat_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_sessions"
  WHERE (("conversation_sessions"."id" = "chat_messages"."session_id") AND (("conversation_sessions"."browser_session_id" IS NOT NULL) OR (("auth"."uid"() IS NOT NULL) AND ("conversation_sessions"."profile_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view messages in their sessions" ON "public"."chat_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_sessions"
  WHERE (("conversation_sessions"."id" = "chat_messages"."session_id") AND ("conversation_sessions"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their conversation sessions" ON "public"."conversation_sessions" FOR SELECT USING ((("browser_session_id" IS NOT NULL) OR (("auth"."uid"() IS NOT NULL) AND ("profile_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own conversation sessions" ON "public"."conversation_sessions" FOR SELECT USING (("auth"."uid"() = "profile_id"));



ALTER TABLE "public"."general_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."institutions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_job"("p_job_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_job"("p_job_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_job"("p_job_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."execute_sql"("sql" "text", "params" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."execute_sql"("sql" "text", "params" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_sql"("sql" "text", "params" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_embeddings_by_id"("p_query_id" "uuid", "p_table_name" "text", "p_match_threshold" double precision, "p_match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_embeddings_by_id"("p_query_id" "uuid", "p_table_name" "text", "p_match_threshold" double precision, "p_match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_embeddings_by_id"("p_query_id" "uuid", "p_table_name" "text", "p_match_threshold" double precision, "p_match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_embeddings_by_vector"("p_query_embedding" "extensions"."vector", "p_table_name" "text", "p_match_threshold" double precision, "p_match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_embeddings_by_vector"("p_query_embedding" "extensions"."vector", "p_table_name" "text", "p_match_threshold" double precision, "p_match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_embeddings_by_vector"("p_query_embedding" "extensions"."vector", "p_table_name" "text", "p_match_threshold" double precision, "p_match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_job_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_job_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_job_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."agent_actions" TO "anon";
GRANT ALL ON TABLE "public"."agent_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_actions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_model_invocations" TO "anon";
GRANT ALL ON TABLE "public"."ai_model_invocations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_model_invocations" TO "service_role";



GRANT ALL ON TABLE "public"."capabilities" TO "anon";
GRANT ALL ON TABLE "public"."capabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."capability_levels" TO "anon";
GRANT ALL ON TABLE "public"."capability_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."capability_levels" TO "service_role";



GRANT ALL ON TABLE "public"."career_paths" TO "anon";
GRANT ALL ON TABLE "public"."career_paths" TO "authenticated";
GRANT ALL ON TABLE "public"."career_paths" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_sessions" TO "anon";
GRANT ALL ON TABLE "public"."conversation_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."divisions" TO "anon";
GRANT ALL ON TABLE "public"."divisions" TO "authenticated";
GRANT ALL ON TABLE "public"."divisions" TO "service_role";



GRANT ALL ON TABLE "public"."general_role_types" TO "anon";
GRANT ALL ON TABLE "public"."general_role_types" TO "authenticated";
GRANT ALL ON TABLE "public"."general_role_types" TO "service_role";



GRANT ALL ON TABLE "public"."general_roles" TO "anon";
GRANT ALL ON TABLE "public"."general_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."general_roles" TO "service_role";



GRANT ALL ON TABLE "public"."institutions" TO "anon";
GRANT ALL ON TABLE "public"."institutions" TO "authenticated";
GRANT ALL ON TABLE "public"."institutions" TO "service_role";



GRANT ALL ON TABLE "public"."job_documents" TO "anon";
GRANT ALL ON TABLE "public"."job_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."job_documents" TO "service_role";



GRANT ALL ON TABLE "public"."job_skills" TO "anon";
GRANT ALL ON TABLE "public"."job_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."job_skills" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."jobs_history" TO "anon";
GRANT ALL ON TABLE "public"."jobs_history" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs_history" TO "service_role";



GRANT ALL ON TABLE "public"."profile_agent_actions" TO "anon";
GRANT ALL ON TABLE "public"."profile_agent_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_agent_actions" TO "service_role";



GRANT ALL ON TABLE "public"."profile_capabilities" TO "anon";
GRANT ALL ON TABLE "public"."profile_capabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."profile_career_paths" TO "anon";
GRANT ALL ON TABLE "public"."profile_career_paths" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_career_paths" TO "service_role";



GRANT ALL ON TABLE "public"."profile_job_interactions" TO "anon";
GRANT ALL ON TABLE "public"."profile_job_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_job_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."profile_skills" TO "anon";
GRANT ALL ON TABLE "public"."profile_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_skills" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."role_capabilities" TO "anon";
GRANT ALL ON TABLE "public"."role_capabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."role_capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."role_documents" TO "anon";
GRANT ALL ON TABLE "public"."role_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."role_documents" TO "service_role";



GRANT ALL ON TABLE "public"."role_skills" TO "anon";
GRANT ALL ON TABLE "public"."role_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."role_skills" TO "service_role";



GRANT ALL ON TABLE "public"."role_taxonomies" TO "anon";
GRANT ALL ON TABLE "public"."role_taxonomies" TO "authenticated";
GRANT ALL ON TABLE "public"."role_taxonomies" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."skills" TO "anon";
GRANT ALL ON TABLE "public"."skills" TO "authenticated";
GRANT ALL ON TABLE "public"."skills" TO "service_role";



GRANT ALL ON TABLE "public"."taxonomy" TO "anon";
GRANT ALL ON TABLE "public"."taxonomy" TO "authenticated";
GRANT ALL ON TABLE "public"."taxonomy" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
