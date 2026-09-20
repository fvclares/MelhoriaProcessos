# MVP 7 — Produto SaaS (histórico substituído)

> Este roteiro registra o experimento multiempresa validado em 2026-09-18. Ele foi substituído pela migration `20260918188000_single_institution.sql`; não o utilize para publicar o estado atual da aplicação.

Esta migration cria empresas, membros, unidades e associa os dados existentes à organização inicial. Antes de publicar, crie ao menos um usuário no Supabase Auth e insira-o em `company_members` como `admin` da empresa inicial.

O gate de validação exige testes com duas empresas: um usuário de cada uma não pode consultar dados, embeddings, entidades ou indicadores da outra. A aplicação das Edge Functions precisa receber o usuário autenticado e resolver a empresa exclusivamente pela associação `company_members`; nunca pelo frontend.
