import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── helpers ── */

function chunkText(
  text: string,
  maxTokens = 1000
): { text: string; page_number: number | null; section_heading: string | null }[] {
  const maxChars = maxTokens * 4;
  const chunks: {
    text: string;
    page_number: number | null;
    section_heading: string | null;
  }[] = [];

  const paragraphs = text.split(/\n{2,}/);
  let current = "";
  let currentPage: number | null = null;
  let currentHeading: string | null = null;

  for (const para of paragraphs) {
    const headingMatch = para.match(/^#{1,3}\s+(.+)$/) ||
      (para.length < 80 && para === para.toUpperCase() && para.trim().length > 3 ? [null, para] : null);

    if (headingMatch) {
      currentHeading = (headingMatch[1] || para).trim();
    }

    // Detect page markers
    const pageMarker = para.match(/\[PAGE_(\d+)\]/);
    if (pageMarker) {
      currentPage = parseInt(pageMarker[1]);
    }

    if ((current + "\n\n" + para).length > maxChars && current.length > 0) {
      chunks.push({
        text: current.trim(),
        page_number: currentPage,
        section_heading: currentHeading,
      });
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  if (current.trim()) {
    chunks.push({
      text: current.trim(),
      page_number: currentPage,
      section_heading: currentHeading,
    });
  }

  return chunks.map((c, i) => {
    const pageMatch = c.text.match(/\[PAGE_(\d+)\]/);
    return {
      ...c,
      page_number: pageMatch ? parseInt(pageMatch[1]) : c.page_number ?? (i + 1),
    };
  });
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function profileCSV(headers: string[], rows: string[][]): any {
  const profile: any = { columns: [], row_count: rows.length, column_count: headers.length };

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const colName = headers[colIdx];
    const values = rows.map((r) => r[colIdx] || "").filter((v) => v !== "");
    const missing = rows.length - values.length;
    const missingPct = rows.length > 0 ? ((missing / rows.length) * 100).toFixed(1) : "0";

    // Try numeric
    const numericVals = values.map(Number).filter((n) => !isNaN(n));
    const isNumeric = numericVals.length > values.length * 0.7;

    const colProfile: any = {
      name: colName,
      missing_count: missing,
      missing_pct: parseFloat(missingPct),
      total: rows.length,
      unique_count: new Set(values).size,
    };

    if (isNumeric && numericVals.length > 0) {
      colProfile.type = "numeric";
      colProfile.min = Math.min(...numericVals);
      colProfile.max = Math.max(...numericVals);
      colProfile.mean = parseFloat((numericVals.reduce((a, b) => a + b, 0) / numericVals.length).toFixed(2));
    } else {
      colProfile.type = "categorical";
      const freq: Record<string, number> = {};
      for (const v of values) freq[v] = (freq[v] || 0) + 1;
      const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
      colProfile.top_values = sorted.slice(0, 5).map(([val, count]) => ({ value: val, count }));
    }

    profile.columns.push(colProfile);
  }

  return profile;
}

async function extractTextFromFile(
  supabaseAdmin: any,
  filePath: string,
  filename: string
): Promise<{ text: string; fileType: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from("staff_documents")
    .download(filePath);

  if (error || !data) {
    throw new Error(`Failed to download file: ${error?.message}`);
  }

  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "txt" || ext === "md") {
    return { text: await data.text(), fileType: "text" };
  }

  if (ext === "csv") {
    const text = await data.text();
    return { text, fileType: "csv" };
  }

  const arrayBuf = await data.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);

  if (bytes.length > 20 * 1024 * 1024) {
    throw new Error("File exceeds 20MB size limit");
  }

  if (ext === "pdf") {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return { text: `[BASE64_PDF]${base64}`, fileType: "pdf" };
  }

  if (ext === "docx" || ext === "doc") {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return { text: `[BASE64_DOCX]${base64}`, fileType: "docx" };
  }

  return { text: await data.text(), fileType: "text" };
}

async function callAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  retries = 2
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.1,
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429 || response.status === 402) {
          throw new Error(`AI rate limit: ${response.status}`);
        }
        throw new Error(`AI error ${response.status}: ${errText}`);
      }

      const json = await response.json();
      return json.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("AI call failed after retries");
}

function extractJSON(text: string): any {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
    text.match(/\[[\s\S]*\]/) ||
    text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    const candidate = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(candidate);
  }
  return JSON.parse(text);
}

async function logAudit(
  supabaseAdmin: any,
  documentId: string,
  stage: string,
  message: string,
  payload: any = {}
) {
  await supabaseAdmin.from("doc_audit_events").insert({
    document_id: documentId,
    stage,
    message,
    payload_json: payload,
  });
}

/* ── CSV Pipeline ── */

async function processCSV(
  supabaseAdmin: any,
  apiKey: string,
  documentId: string,
  csvText: string,
  doc: any
) {
  // Stage 1: parse_csv
  await logAudit(supabaseAdmin, documentId, "parse_csv", "Parsing CSV file");
  const { headers, rows } = parseCSV(csvText);

  if (headers.length > 100) {
    throw new Error("CSV exceeds 100-column limit. Please reduce the number of columns.");
  }
  if (rows.length > 10000) {
    throw new Error("CSV exceeds 10,000-row limit. Please reduce the dataset size.");
  }

  await logAudit(supabaseAdmin, documentId, "parse_csv", `Parsed ${rows.length} rows, ${headers.length} columns`, {
    row_count: rows.length,
    column_count: headers.length,
  });

  // Stage 2: profile_csv
  await logAudit(supabaseAdmin, documentId, "profile_csv", "Profiling CSV data");
  const profile = profileCSV(headers, rows);

  // Store CSV preview data as chunks
  const previewRows = rows.slice(0, 50);
  const csvPreviewChunk = {
    document_id: documentId,
    chunk_index: 0,
    page_number: null,
    section_heading: "CSV Data Preview",
    text: JSON.stringify({ headers, rows: previewRows, profile }),
  };

  await supabaseAdmin.from("document_chunks").insert([csvPreviewChunk]);
  await logAudit(supabaseAdmin, documentId, "profile_csv", "CSV profiling complete", { profile_summary: { row_count: profile.row_count, column_count: profile.column_count } });

  // Stage 3: generate_outputs_from_csv
  await logAudit(supabaseAdmin, documentId, "generate_csv_analysis", "Generating analysis from CSV data");

  const strictNote = doc.strict_mode
    ? "STRICT EVIDENCE MODE: Every claim MUST reference specific column_name and computed_metric from the profile. If insufficient context, add to open_questions. Do NOT invent numbers."
    : "";

  const csvAnalysisPrompt = `Analyze this CSV dataset and generate structured outputs.

${strictNote}

CSV Profile:
${JSON.stringify(profile, null, 2)}

Sample data (first 10 rows):
Headers: ${headers.join(", ")}
${rows.slice(0, 10).map((r) => r.join(", ")).join("\n")}

Return a JSON object:
{
  "action_items": [
    {
      "title": "string - actionable insight from the data",
      "owner": null,
      "due_date": null,
      "supporting_quote": "string - reference to specific column stats",
      "citations": [{"chunk_id": "csv_profile", "column_name": "string", "metric": "string"}]
    }
  ],
  "risks": [
    {
      "risk_type": "data_quality|anomaly|missing_data",
      "description": "string",
      "requirement_or_clause": "string - specific metric reference",
      "severity": "low|medium|high",
      "citations": [{"chunk_id": "csv_profile", "column_name": "string", "metric": "string"}]
    }
  ],
  "open_questions": ["string - questions that can't be answered from data alone"]
}

Return ONLY valid JSON, no other text.`;

  let analysisJson: any;
  try {
    const result = await callAI(
      apiKey,
      "You analyze CSV datasets. Output ONLY valid JSON. Reference specific columns and metrics.",
      csvAnalysisPrompt
    );
    analysisJson = extractJSON(result);
  } catch (e) {
    await logAudit(supabaseAdmin, documentId, "error", `CSV analysis failed: ${e.message}`);
    analysisJson = { action_items: [], risks: [], open_questions: [] };
  }

  // Generate memo from CSV
  const memoPrompt = `Generate a 1-page data analysis memo for this CSV dataset.
Target audience: ${doc.audience}
Tone: ${doc.tone}

${strictNote}

CSV Profile:
${JSON.stringify(profile, null, 2)}

Analysis Results:
${JSON.stringify(analysisJson, null, 2)}

Sections:
1. **Data Summary** - Overview of the dataset
2. **Key Findings** - What the data shows
3. **Data Quality Issues** - Missing data, anomalies
4. **Recommendations** - Actions based on findings
5. **Open Questions** - What needs further investigation
6. **Data References** - Columns and metrics used

Keep it concise. Reference specific column names and metrics.`;

  let memoText: string;
  try {
    memoText = await callAI(
      apiKey,
      `You write data analysis memos for school district leadership. Write clear, ${doc.tone} memos.`,
      memoPrompt
    );
  } catch (e) {
    await logAudit(supabaseAdmin, documentId, "error", `CSV memo generation failed: ${e.message}`);
    memoText = "Memo generation failed. Please retry.";
  }

  // Build citations
  const citationsJson = [
    {
      source: "csv_profile",
      chunk_id: "csv_profile",
      page_number: null,
      section_heading: "CSV Data Profile",
      snippet: `Dataset: ${profile.row_count} rows × ${profile.column_count} columns. Columns: ${headers.join(", ")}`,
    },
  ];

  // Check for PII
  const piiPatterns = /\b(student\s+id|ssn|social\s+security|date\s+of\s+birth|dob|iep|504\s+plan|special\s+education)\b/gi;
  const sampleText = headers.join(" ") + " " + rows.slice(0, 20).map((r) => r.join(" ")).join(" ");
  const piiDetected = piiPatterns.test(sampleText);

  // Save outputs
  await supabaseAdmin.from("document_outputs").insert({
    document_id: documentId,
    action_items_json: analysisJson.action_items || [],
    risks_json: analysisJson.risks || [],
    memo_text: memoText,
    citations_json: citationsJson,
  });

  await supabaseAdmin
    .from("documents")
    .update({ status: "complete" })
    .eq("id", documentId);

  await logAudit(supabaseAdmin, documentId, "complete", "CSV processing complete", {
    action_items_count: (analysisJson.action_items || []).length,
    risks_count: (analysisJson.risks || []).length,
    pii_detected: piiDetected,
    file_type: "csv",
  });

  return { piiDetected, actionItemsCount: (analysisJson.action_items || []).length, risksCount: (analysisJson.risks || []).length };
}

/* ── PDF/DOCX Pipeline ── */

async function processPDFDocx(
  supabaseAdmin: any,
  apiKey: string,
  documentId: string,
  rawText: string,
  fileType: string,
  doc: any
) {
  // Stage 1: extract_text
  await logAudit(supabaseAdmin, documentId, "extract_text", "Extracting text from document");

  let documentText = rawText;
  let ocrUsed = false;

  if (rawText.startsWith("[BASE64_PDF]") || rawText.startsWith("[BASE64_DOCX]")) {
    const ft = rawText.startsWith("[BASE64_PDF]") ? "PDF" : "DOCX";
    const base64Content = rawText.replace(/^\[BASE64_(PDF|DOCX)\]/, "");

    documentText = await callAI(
      apiKey,
      `You are a document text extractor. Extract ALL text content from this ${ft} document. Preserve paragraph structure. Mark page breaks as [PAGE_X] where X is the page number. If you detect section headings, preserve them. Output ONLY the extracted text, nothing else.`,
      `Extract text from this base64-encoded ${ft} document:\n\n${base64Content.substring(0, 100000)}`
    );

    await logAudit(supabaseAdmin, documentId, "extract_text", `AI text extraction complete (${ft})`, {
      text_length: documentText.length,
    });

    // OCR fallback check
    if (documentText.length < 1000) {
      await logAudit(supabaseAdmin, documentId, "extract_text", "Low extractable text detected, switching to OCR", {
        ocr: true,
        initial_text_length: documentText.length,
      });

      ocrUsed = true;

      try {
        documentText = await callAI(
          apiKey,
          `You are an OCR text extractor. This document appears to be scanned. Carefully extract ALL visible text, including text in images, headers, footers, tables, and handwritten notes. Mark page breaks as [PAGE_X]. Preserve structure as much as possible. Output ONLY the extracted text.`,
          `OCR extract from this base64-encoded ${ft} (scanned document):\n\n${base64Content.substring(0, 100000)}`
        );

        await logAudit(supabaseAdmin, documentId, "extract_text", `OCR extraction complete`, {
          ocr: true,
          text_length: documentText.length,
        });

        if (documentText.length < 200) {
          throw new Error("OCR produced insufficient text");
        }
      } catch (e) {
        await logAudit(supabaseAdmin, documentId, "error", `OCR extraction failed: ${e.message}`, { ocr: true });
        throw new Error("Unable to extract readable text. Try exporting to searchable PDF.");
      }
    }
  }

  // PII detection
  const piiPatterns = /\b(student\s+id|ssn|social\s+security|date\s+of\s+birth|dob|iep|504\s+plan|special\s+education)\b/gi;
  const piiDetected = piiPatterns.test(documentText);

  // Stage 2: chunk
  const chunks = chunkText(documentText);

  if (chunks.length > 50) {
    await logAudit(supabaseAdmin, documentId, "warning", "Document exceeds 50-page limit, truncating", {
      total_chunks: chunks.length,
    });
    chunks.length = 50;
  }

  const chunkRows = chunks.map((c, i) => ({
    document_id: documentId,
    chunk_index: i,
    page_number: c.page_number,
    section_heading: c.section_heading,
    text: c.text,
  }));

  await supabaseAdmin.from("document_chunks").insert(chunkRows);
  await logAudit(supabaseAdmin, documentId, "chunk", `Created ${chunks.length} chunks`);

  // Build context
  const contextForAI = chunks
    .map((c, i) => {
      const meta = [
        `chunk_id: chunk_${i}`,
        c.page_number ? `page: ${c.page_number}` : null,
        c.section_heading ? `section: ${c.section_heading}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `[${meta}]\n${c.text}`;
    })
    .join("\n\n---\n\n");

  const strictNote = doc.strict_mode
    ? "STRICT EVIDENCE MODE IS ON. Every action item, risk, and memo statement MUST have at least 1 citation from the document chunks. If evidence is insufficient, mark it as an open_question instead of guessing. Dates, numbers, and requirements MUST appear in the cited snippet."
    : "";

  // Stage 3: extract_json (combined action items + risks + open questions)
  await logAudit(supabaseAdmin, documentId, "extract_json", "Extracting structured data with strict citations");

  const extractPrompt = `Analyze this ${doc.doc_type} document and extract structured data.

${strictNote}

Return a JSON object with this EXACT schema:
{
  "action_items": [
    {
      "title": "string - the action item",
      "owner": "string or null - who is responsible",
      "due_date": "string or null - deadline if mentioned",
      "supporting_quote": "string - exact quote from document",
      "citations": [{"chunk_id": "chunk_N", "page_number": N_or_null}]
    }
  ],
  "risks": [
    {
      "risk_type": "string - compliance|financial|operational|legal",
      "description": "string - what the risk/requirement is",
      "requirement_or_clause": "string - the specific clause or requirement",
      "severity": "low|medium|high",
      "citations": [{"chunk_id": "chunk_N", "page_number": N_or_null}]
    }
  ],
  "open_questions": ["string - items needing verification or insufficient evidence"]
}

RULES:
- Every action item MUST have at least one citation.
- Every risk MUST have at least one citation.
- Dates and numbers MUST appear in the cited chunk text.
- If insufficient evidence, add to open_questions instead.
- Return empty arrays if nothing found.
- Return ONLY valid JSON, no other text.

Document context:
${contextForAI}`;

  let extractedData: any = { action_items: [], risks: [], open_questions: [] };
  let extractAttempts = 0;

  while (extractAttempts < 3) {
    try {
      const aiResult = await callAI(
        apiKey,
        "You extract structured data from documents. Output ONLY valid JSON objects with action_items, risks, and open_questions arrays.",
        extractPrompt
      );
      extractedData = extractJSON(aiResult);
      if (!extractedData.action_items) extractedData.action_items = [];
      if (!extractedData.risks) extractedData.risks = [];
      if (!extractedData.open_questions) extractedData.open_questions = [];
      break;
    } catch (e) {
      extractAttempts++;
      if (extractAttempts >= 3) {
        await logAudit(supabaseAdmin, documentId, "error", `Structured extraction failed after ${extractAttempts} attempts: ${e.message}`);
      }
    }
  }

  // Stage 4: draft_memo
  await logAudit(supabaseAdmin, documentId, "draft_memo", "Generating board memo");

  const memoPrompt = `Generate a one-page board-safe memo based on this ${doc.doc_type} document.
Target audience: ${doc.audience}
Tone: ${doc.tone}

${strictNote}

Structure the memo with these sections:
1. **Summary** - 2-3 sentences
2. **Key Decisions / Asks** - bullet points
3. **Timeline & Deadlines** - if any
4. **Risks & Mitigations** - if any
5. **Open Questions** - items needing verification
6. **Citations Appendix** - reference chunk IDs used

No unsupported claims allowed. Keep it concise — maximum one page.

Previously extracted data:
Action Items: ${JSON.stringify(extractedData.action_items)}
Risks: ${JSON.stringify(extractedData.risks)}
Open Questions: ${JSON.stringify(extractedData.open_questions)}

Document context:
${contextForAI}`;

  let memoText: string;
  try {
    memoText = await callAI(
      apiKey,
      `You are a professional memo writer for school district leadership. Write clear, ${doc.tone} memos.`,
      memoPrompt
    );
  } catch (e) {
    await logAudit(supabaseAdmin, documentId, "error", `Memo generation failed: ${e.message}`);
    memoText = "Memo generation failed. Please retry.";
  }

  // Build citations index
  const allCitations: any[] = [];
  const addCitations = (items: any[], source: string) => {
    for (const item of items) {
      if (item.citations) {
        for (const cit of item.citations) {
          const chunkIdx = parseInt((cit.chunk_id || "").replace("chunk_", ""), 10);
          const chunk = chunks[chunkIdx];
          allCitations.push({
            source,
            chunk_id: cit.chunk_id,
            page_number: cit.page_number ?? chunk?.page_number ?? null,
            section_heading: chunk?.section_heading ?? null,
            snippet: chunk ? chunk.text.substring(0, 300) : item.supporting_quote || "N/A",
          });
        }
      }
    }
  };

  addCitations(extractedData.action_items, "action_item");
  addCitations(extractedData.risks, "risk");

  // Stage 5: save_outputs
  await supabaseAdmin.from("document_outputs").insert({
    document_id: documentId,
    action_items_json: extractedData.action_items,
    risks_json: extractedData.risks,
    memo_text: memoText,
    citations_json: allCitations,
  });

  await supabaseAdmin
    .from("documents")
    .update({ status: "complete" })
    .eq("id", documentId);

  await logAudit(supabaseAdmin, documentId, "complete", "Processing complete", {
    action_items_count: extractedData.action_items.length,
    risks_count: extractedData.risks.length,
    open_questions_count: extractedData.open_questions.length,
    citations_count: allCitations.length,
    pii_detected: piiDetected,
    ocr_used: ocrUsed,
    file_type: fileType,
  });

  return {
    piiDetected,
    ocrUsed,
    actionItemsCount: extractedData.action_items.length,
    risksCount: extractedData.risks.length,
  };
}

/* ── main handler ── */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "document_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: doc, error: docErr } = await userClient
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      return new Response(
        JSON.stringify({ error: "Document not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabaseAdmin
      .from("documents")
      .update({ status: "processing" })
      .eq("id", document_id);

    await logAudit(supabaseAdmin, document_id, "start", "Processing started");

    try {
      // Stage 0: detect_file_type
      const ext = doc.filename.toLowerCase().split(".").pop();
      const detectedType = ext === "csv" ? "csv" : ext === "pdf" ? "pdf" : (ext === "docx" || ext === "doc") ? "docx" : "text";

      await logAudit(supabaseAdmin, document_id, "detect_file_type", `Detected file type: ${detectedType}`, {
        file_type: detectedType,
        filename: doc.filename,
      });

      // Extract raw content
      const { text: rawText, fileType } = await extractTextFromFile(supabaseAdmin, doc.file_path, doc.filename);

      let result: any;

      if (fileType === "csv") {
        result = await processCSV(supabaseAdmin, apiKey, document_id, rawText, doc);
      } else {
        result = await processPDFDocx(supabaseAdmin, apiKey, document_id, rawText, fileType, doc);
      }

      return new Response(
        JSON.stringify({
          success: true,
          pii_detected: result.piiDetected,
          ocr_used: result.ocrUsed || false,
          action_items_count: result.actionItemsCount,
          risks_count: result.risksCount,
          file_type: fileType,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (pipelineError) {
      await supabaseAdmin
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document_id);

      await logAudit(
        supabaseAdmin,
        document_id,
        "failed",
        pipelineError.message || "Unknown pipeline error",
        { error: String(pipelineError) }
      );

      return new Response(
        JSON.stringify({ error: pipelineError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("process-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
