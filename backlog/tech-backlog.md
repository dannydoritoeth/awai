Switch embeddings from text-embedding-ada-002 to >
    await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: yourText,
    dimensions: 768
    });


Chat streaming from postgres. Preferrable if possible than using supabase 