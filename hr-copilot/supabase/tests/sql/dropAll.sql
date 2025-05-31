DO $$ DECLARE
    obj RECORD;
BEGIN
    -- Drop functions
    FOR obj IN
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
    LOOP
        EXECUTE FORMAT('DROP FUNCTION IF EXISTS public.%I CASCADE;', obj.routine_name);
    END LOOP;

    -- Drop views
    FOR obj IN
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
    LOOP
        EXECUTE FORMAT('DROP VIEW IF EXISTS public.%I CASCADE;', obj.table_name);
    END LOOP;

    -- Drop tables
    FOR obj IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE FORMAT('DROP TABLE IF EXISTS public.%I CASCADE;', obj.tablename);
    END LOOP;

    -- Drop types
    FOR obj IN
        SELECT t.typname
        FROM pg_type t
        LEFT JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typtype = 'e'  -- enum types
    LOOP
        EXECUTE FORMAT('DROP TYPE IF EXISTS public.%I CASCADE;', obj.typname);
    END LOOP;

    -- Drop sequences
    FOR obj IN
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE FORMAT('DROP SEQUENCE IF EXISTS public.%I CASCADE;', obj.sequence_name);
    END LOOP;
END $$;
