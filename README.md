下面是对你提供的材料做的**结构化系统级总结（architecture + functional specification）**，我做了三层抽象：

1. **产品目标与学习闭环**
2. **系统架构（logical + service decomposition）**
3. **核心功能模块说明（按AI教育系统分层）**

尽量去掉“README叙述风格”，提升为**可用于系统设计文档 / 技术方案说明**的版本。

---

# 1. System Overview（系统目标）

该系统是一个 **AI 驱动的 IELTS 自适应学习平台（Adaptive IELTS Trainer）**，核心目标是：

> 将用户从当前 IELTS 水平，通过诊断 + 动态训练 + AI评估，持续推进到更高 band（如 Band 6 → 7）。

### 核心学习闭环

系统的本质是一个 closed-loop learning system：

```
Diagnostic Assessment
        ↓
Skill-specific Practice Generation
        ↓
User Response Collection
        ↓
AI-based Evaluation (rubric / objective)
        ↓
Weakness Detection
        ↓
Adaptive Next Exercise Generation
        ↓
Progress Tracking & Analytics
```

---

# 2. High-Level Architecture（系统架构）

## 2.1 Logical Architecture

系统由四个核心层组成：

```
Frontend (React + Vite + MUI)
        ↓
API Layer (FastAPI)
        ↓
AI Service Layer (LLM + Speech Processing)
        ↓
Data Layer (MongoDB)
```

---

## 2.2 Backend Service Decomposition（服务拆分逻辑）

### 1. Practice Generation Service

负责生成所有 IELTS 练习内容：

* Reading passages + questions
* Listening scripts
* Writing prompts
* Speaking cue cards

特点：

* 基于 LLM（OpenRouter / Claude）
* 按 skill + difficulty band 控制生成

---

### 2. Evaluation Service（核心AI评分系统）

负责对用户答案进行评分：

#### Objective tasks（Reading / Listening）

* 标准答案比对
* 自动 scoring

#### Subjective tasks（Writing / Speaking）

* LLM rubric evaluation
* IELTS band estimation

评分维度：

```
Writing:
- Task Response
- Coherence & Cohesion
- Lexical Resource
- Grammar Accuracy

Speaking:
- Fluency
- Lexical Resource
- Grammar
- Pronunciation (approx via transcript/audio signals)
```

---

### 3. Speech Processing Service

处理 speaking 输入：

* Speech-to-Text (STT via OpenRouter)
* Text-to-Speech (TTS for listening practice)
* Audio ingestion (record/upload/dictate)

---

### 4. Adaptive Learning / Analytics Service（隐含核心能力）

基于历史数据：

* 用户 band progression
* skill weaknesses
* mistake patterns

输出：

```
next difficulty level
targeted exercises
weakness-based practice
```

---

### 5. Authentication & Session Service

* JWT authentication
* session tracking
* user isolation

---

### 6. Data Persistence Layer (MongoDB)

核心 collections：

```
users
practice_sessions
results / evaluations
diagnostic_scores
```

数据特征：

* session-based tracking
* skill-tagged records (reading/listening/writing/speaking)
* full history for longitudinal analytics

---

# 3. Diagnostic System（基线能力建模）

系统首次使用时执行：

## 4-skill diagnostic test

| Skill     | Task Type               |
| --------- | ----------------------- |
| Reading   | passage + MCQ           |
| Listening | short audio + questions |
| Writing   | Task 2 essay            |
| Speaking  | cue card response       |

输出：

```
baseline_band_score
per-skill proficiency profile
```

作用：

* 初始化 difficulty level
* 作为 adaptive engine input

---

# 4. Core Functional Modules（功能模块分解）

---

## 4.1 Reading Module

### 功能：

* AI生成 academic passages
* MCQ + gap-fill questions
* server-side answer validation

### 特点：

* deterministic scoring (non-LLM)
* hidden answer key stored server-side
* session-based tracking

---

## 4.2 Listening Module

### 功能：

* LLM-generated scripts
* TTS audio generation
* objective questions

### Speech pipeline:

```
Text script → TTS → Audio playback
```

可扩展：

* accents
* noise augmentation
* multi-speaker simulation

---

## 4.3 Writing Module

### 功能：

* Task 1 (report)
* Task 2 (essay)

### Evaluation:

LLM-based rubric scoring:

```
input: essay text
output:
  band score
  structured feedback
  improvement suggestions
```

---

## 4.4 Speaking Module

### Input modes:

* audio recording
* upload
* transcript input
* typed answer

### Pipeline:

```
Audio → STT → Transcript → LLM evaluation → band score
```

### Scoring:

* fluency
* vocabulary
* grammar
* pronunciation (approx via proxy signals)

---

## 4.5 Progress Tracking Module

Stores longitudinal learning data:

Each attempt contains:

```
user response
score / band
feedback
timestamp
skill type
```

Supports:

* history review
* skill-based filtering
* performance trends

---

# 5. AI Architecture (核心智能设计)

## 5.1 Agent-based conceptual model（建议架构）

系统可以抽象为 4 类 AI agents：

```
Task Generation Agent
Evaluation Agent
Feedback Agent
Difficulty Adaptation Agent
```

形成 pipeline：

```
generate → practice → evaluate → diagnose → adapt
```

---

## 5.2 Evaluation Reliability Strategy

当前问题：LLM评分不稳定

增强方案：

### Multi-judge system

```
LLM Judge A
LLM Judge B
LLM Judge C
        ↓
Aggregation (median/weighted)
```

Writing and speaking evaluation in the API uses **three parallel judges** by default: each judge gets a slightly different calibration instruction, **per-category scores** and the **rubric band label** are aggregated with the **median**, and **feedback text** (overall, strengths, improvements, excerpt) comes from the judge whose **total score** is closest to that median (so narratives stay coherent). Set environment variable `EVAL_JUDGE_COUNT=1` to fall back to a single judge (lower latency and cost).

---

## 5.3 Adaptive Learning Engine

核心逻辑：

```
user_band
    ↓
skill weakness profile
    ↓
next exercise difficulty
```

输出：

* targeted practice
* adaptive difficulty adjustment
* skill-specific reinforcement

---

## 5.4 Feedback Transformation Layer

将抽象评分转化为 actionable guidance：

### Bad:

```
Improve grammar
```

### Good:

```
You overuse "very".
Replace with:
- significantly
- considerably
```

---

# 6. System Workflow Summary（端到端流程）

## 6.1 Practice Flow

```
User request
   ↓
Generate practice (LLM)
   ↓
Store session (MongoDB)
   ↓
User attempts
   ↓
Submit answers
   ↓
Evaluation engine
   ↓
Store results
   ↓
Return feedback
```

---

## 6.2 Writing/Speaking Flow

```
User input (text/audio)
        ↓
STT (if audio)
        ↓
LLM rubric evaluation
        ↓
band score + feedback
        ↓
progress update
```

---

## 6.3 Adaptive Loop

```
performance history
        ↓
weakness detection
        ↓
next task difficulty adjustment
        ↓
new practice generation
```

---

# 7. Key Design Principles

### 1. Server-side truth control

* answers hidden from client
* prevents cheating
* enables consistent scoring

---

### 2. Session-based learning model

* each practice = structured session
* enables replay + analytics

---

### 3. LLM for open-ended evaluation only

* deterministic logic for MCQ
* LLM only for subjective tasks

---

### 4. Longitudinal learning tracking

* not single-task scoring
* but progress over time

---

# 8. System Positioning（产品本质）

从系统设计角度，这不是：

> IELTS practice tool

而是：

> AI-driven adaptive language learning system

更接近：

* Duolingo adaptive engine
* ELSA Speak (speech feedback)
* IELTS Coach simulator

---
