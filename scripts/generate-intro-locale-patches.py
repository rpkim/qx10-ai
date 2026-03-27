#!/usr/bin/env python3
"""Generate lib/demo/patches/service-intro.{ko,ja,es,zh}.json from embedded strings."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "lib" / "demo" / "patches"


def W(*parts: str) -> str:
    return "\n\n".join(p.strip() for p in parts if p.strip())


# --- Korean ---
KO = {
    "keyword": "대규모 언어 모델",
    "nodes": {
        "root": {"keyword": "대규모 언어 모델"},
        "q-custom-1774628253903": {
            "question": "대규모 언어 모델(LLM)의 정의는 무엇이며 다른 AI 모델과 어떻게 다른가요?"
        },
        "ans-q-custom-1774628253903-1774628253925": {
            "content": W(
                "**대규모 언어 모델(LLM)**은 사람의 언어를 이해하고 생성하도록 설계된 신경망입니다. "
                "“대규모”는 수십억~수조 개의 **파라미터**와 방대한 **텍스트 코퍼스**로 학습한다는 뜻입니다.",
                "핵심은 다음 단어(토큰)를 예측하는 **언어 모델링** 목표로, 대부분 **트랜스포머** 구조를 씁니다. "
                "일반 AI 모델이 좁은 작업에 특화된 반면, LLM은 요약·번역·코드 생성 등 **범용 언어 작업**에 강합니다.",
                "### 다른 모델과의 차이\n"
                "1. **규모와 범용성** — 하나의 모델로 여러 작업을 처리합니다.\n"
                "2. **아키텍처** — 최신 LLM은 주로 트랜스포머 기반입니다.\n"
                "3. **데이터** — 주로 텍스트·코드 중심으로 학습합니다.\n"
                "4. **창발적 능력** — 규모가 커지면 추론·도구 사용 같은 행동이 나타나기도 합니다.",
            ),
            "extractedKeywords": [
                "대규모 언어 모델",
                "파라미터",
                "학습 데이터",
                "트랜스포머",
                "다음 토큰 예측",
                "범용성",
                "창발적 능력",
            ],
            "suggestedQueries": [
                "트랜스포머 아키텍처는 어떻게 동작하나요?",
                "LLM이 보여 준 창발적 능력의 예는 무엇인가요?",
                "다른 종류의 AI 모델 사례를 더 들어주실 수 있나요?",
                "최신 LLM의 파라미터 규모는 대략 어느 정도인가요?",
                "방대한 데이터에서 문법과 상식은 어떻게 학습되나요?",
            ],
        },
        "data-q-custom-1774628253903-1774628253925": {
            "title": "LLM vs 기타 AI 모델",
            "tableColumns": ["측면", "대규모 언어 모델(LLM)", "기타 AI 모델"],
            "tableRows": [
                {
                    "측면": "규모·범용성",
                    "대규모 언어 모델(LLM)": "매우 큰 규모, 언어 작업 전반에 범용",
                    "기타 AI 모델": "상대적으로 작고 좁은 작업에 특화",
                },
                {
                    "측면": "아키텍처",
                    "대규모 언어 모델(LLM)": "주로 트랜스포머",
                    "기타 AI 모델": "CNN, RNN 등 도메인별 다양",
                },
                {
                    "측면": "데이터 유형",
                    "대규모 언어 모델(LLM)": "주로 텍스트·코드",
                    "기타 AI 모델": "이미지·오디오·수치 등",
                },
                {
                    "측면": "능력",
                    "대규모 언어 모델(LLM)": "추론·문제 해결 등 창발적 경향",
                    "기타 AI 모델": "작업별 성능, 광범위한 창발은 제한적",
                },
            ],
        },
        "q-custom-1774628275054": {"question": "트랜스포머 아키텍처는 근본적으로 어떻게 동작하나요?"},
        "ans-q-custom-1774628275054-1774628275069": {
            "content": W(
                "트랜스포머는 순차 처리 병목을 줄이고 **자기 주의(self-attention)** 로 문맥을 잡습니다. "
                "인코더는 입력을 풍부한 표현으로 바꾸고, 디코더는 출력을 생성합니다(많은 LLM은 디코더 전용).",
                "**자기 주의**에서는 각 토큰이 시퀀스 전체와의 관련도를 학습합니다. "
                "쿼리·키·값 벡터로 점수를 내고 값을 가중합해 문맥 벡터를 만듭니다.",
                "**다중 헤드 주의**는 여러 관점의 관계를 동시에 봅니다. "
                "**위치 인코딩**은 순서 정보를 임베딩에 더합니다. "
                "피드포워드 층·잔차 연결·층 정규화가 안정적인 학습을 돕습니다.",
            ),
            "extractedKeywords": [
                "트랜스포머",
                "자기 주의",
                "인코더·디코더",
                "다중 헤드",
                "위치 인코딩",
                "피드포워드",
                "잔차 연결",
            ],
            "suggestedQueries": [
                "Q, K, V 벡터는 구체적으로 어떻게 계산되나요?",
                "사용되는 위치 인코딩의 종류는 무엇이 있나요?",
                "인코더-디코더와 디코더 전용의 차이는?",
                "잔차 연결과 층 정규화가 왜 중요한가요?",
                "RNN 대비 트랜스포머의 장점은?",
            ],
        },
        "q-custom-1774628291934": {"question": "LLM이 보여 준 창발적 능력의 구체적 예는 무엇인가요?"},
        "ans-q-custom-1774628291934-1774628291947": {
            "content": W(
                "**창발적 능력**은 명시적으로 코딩되지 않았는데 규모·데이터가 커지며 나타나는 행동입니다.",
                "• **문맥 내 학습**: 프롬프트에 예시만 넣어도 과제를 빠르게 따릅니다.\n"
                "• **생각의 사슬**: 단계적 추론을 유도하면 수학·논리 정확도가 오릅니다.\n"
                "• **지시 따르기**: 다양한 자연어 지시를 일반화합니다.\n"
                "• **도구 사용**: 검색·계산기 등 외부 도구 호출을 학습합니다.\n"
                "• **수학·코드**: 기호 조작과 프로그램 생성·설명이 가능해집니다.",
            ),
            "extractedKeywords": [
                "창발적 능력",
                "문맥 내 학습",
                "생각의 사슬",
                "지시 따르기",
                "도구 사용",
                "수학·코드",
                "모델 규모",
            ],
            "suggestedQueries": [
                "창발 능력은 어떻게 측정하나요?",
                "이 능력이 생겨나는 이론적 설명은?",
                "창발 능력의 한계는?",
                "규모와 창발의 관계는?",
                "앞으로 기대되는 창발은?",
            ],
        },
        "data-q-custom-1774628291934-1774628291947": {
            "title": "LLM의 주요 창발적 능력",
            "listItems": [
                "문맥 내 학습",
                "생각의 사슬 추론",
                "지시 따르기",
                "도구 사용",
                "수학 문제 풀이",
                "코드 생성·이해",
            ],
        },
        "q-custom-1774628312786": {"question": "어떤 종류의 위치 인코딩이 사용되나요?"},
        "ans-q-custom-1774628312786-1774628312802": {
            "content": W(
                "자기 주의는 토큰 순서를 모르므로 **위치 인코딩**으로 순서 정보를 넣습니다.",
                "**절대 위치**: 사인·코사인 고정 인코딩 또는 학습된 위치 임베딩.\n"
                "**상대 위치**: 토큰 간 거리를 주의 점수에 반영.\n"
                "**RoPE** 등은 절대·상대 성질을 함께 활용합니다.",
            ),
            "extractedKeywords": [
                "위치 인코딩",
                "절대·상대",
                "사인·코사인",
                "학습된 위치",
                "RoPE",
                "토큰 임베딩",
            ],
            "suggestedQueries": [
                "토큰 임베딩에 위치를 더하는 방식은?",
                "사인·코사인 위치 인코딩의 직관은?",
                "RoPE가 상대 거리를 담는 이유는?",
            ],
        },
        "q-custom-1774628340570": {"question": "Q, K, V 벡터는 구체적으로 어떻게 계산되나요?"},
        "ans-q-custom-1774628340570-1774628340590": {
            "content": W(
                "각 토큰 임베딩 X에 학습된 행렬 WQ, WK, WV를 곱해 **Q = X·WQ**, **K = X·WK**, **V = X·WV** 를 얻습니다.",
                "세 행렬은 서로 다른 부분공간으로 투영해, 주의에서 “무엇을 찾을지(Q)”, “무엇과 맞출지(K)”, “무엇을 전달할지(V)”를 분리합니다.",
            ),
            "extractedKeywords": [
                "QKV",
                "선형 변환",
                "가중 행렬",
                "자기 주의",
                "다중 헤드",
            ],
            "suggestedQueries": [
                "주의 점수는 Q·K로 어떻게 만들어지나요?",
                "다중 헤드에서 QKV는 어떻게 쓰이나요?",
                "가중 행렬은 어떻게 학습되나요?",
            ],
        },
        "data-q-custom-1774628340570-1774628340590": {
            "title": "QKV 계산 요약",
            "tableColumns": ["벡터", "계산", "입력", "가중 행렬", "출력"],
            "tableRows": [
                {
                    "벡터": "쿼리(Q)",
                    "계산": "X · WQ",
                    "입력": "토큰 임베딩 X",
                    "가중 행렬": "WQ(학습됨)",
                    "출력": "쿼리 벡터",
                },
                {
                    "벡터": "키(K)",
                    "계산": "X · WK",
                    "입력": "토큰 임베딩 X",
                    "가중 행렬": "WK(학습됨)",
                    "출력": "키 벡터",
                },
                {
                    "벡터": "값(V)",
                    "계산": "X · WV",
                    "입력": "토큰 임베딩 X",
                    "가중 행렬": "WV(학습됨)",
                    "출력": "값 벡터",
                },
            ],
        },
        "q-custom-1774628361601": {"question": "사인·코사인 위치 인코딩의 수학적 직관은?"},
        "ans-q-custom-1774628361601-1774628361623": {
            "content": W(
                "사인·코사인은 **각 차원마다 다른 주파수**의 파동으로 위치를 “지문”처럼 만듭니다.",
                "삼각 항등식으로 **상대 위치** 정보가 선형으로 전달되기 쉬워 길이 일반화에 유리합니다.",
            ),
            "extractedKeywords": [
                "사인·코사인",
                "상대 위치",
                "주파수",
                "일반화",
                "트랜스포머",
            ],
            "suggestedQueries": [
                "다른 위치 인코딩 방법은?",
                "d_model 차원과의 관계는?",
            ],
        },
        "q-custom-1774628367568": {
            "question": "대규모 언어 모델이 실제로 가장 많이 쓰이는 응용 분야는?"
        },
        "ans-q-custom-1774628367568-1774628367589": {
            "content": W(
                "**콘텐츠 생성**, **고객 지원 챗봇**, **의미 검색·요약**, **번역·현지화**, **코드 보조**, **교육 튜터링**, **의료 문서 요약(연구 단계)**, **리포트·BI 텍스트 분석** 등이 대표적입니다.",
            ),
            "extractedKeywords": [
                "콘텐츠 생성",
                "고객 지원",
                "의미 검색",
                "번역",
                "코드 보조",
                "교육",
                "데이터 인사이트",
            ],
            "suggestedQueries": [
                "콘텐츠 생성이 빠른 이유는?",
                "고객 서비스 LLM 사례는?",
                "의미 검색과 키워드 검색의 차이?",
            ],
        },
        "data-q-custom-1774628367568-1774628367589": {
            "title": "흔한 LLM 응용",
            "listItems": [
                "콘텐츠 생성(이메일, 기사, 마케팅)",
                "고객 지원(챗봇, 가상 비서)",
                "정보 검색·요약(의미 검색)",
                "번역·현지화",
                "코드 생성·디버깅",
                "맞춤 교육(퀴즈, 튜터)",
                "의료(기록 요약·문헌 조사·연구)",
                "데이터 분석·인사이트 도출",
            ],
        },
        "q-custom-1774628384633": {
            "question": "LLM은 어떤 데이터로 학습되며 성능에 왜 중요한가요?"
        },
        "ans-q-custom-1774628384633-1774628384655": {
            "content": W(
                "주로 **웹 텍스트**(Common Crawl, 위키, 뉴스, 책, 논문, 포럼), **코드**, **대화 데이터**로 학습합니다.",
                "**다양성·규모·품질**이 사실·문법·추론 패턴 학습을 좌우합니다. 데이터 편향은 출력 편향으로 이어질 수 있습니다.",
            ),
            "extractedKeywords": [
                "학습 데이터",
                "웹 텍스트",
                "코드",
                "대화",
                "다양성",
                "편향",
            ],
            "suggestedQueries": [
                "어떤 웹 텍스트가 영향이 큰가요?",
                "품질이 사실성에 미치는 영향은?",
                "데이터 수집의 윤리 이슈는?",
            ],
        },
        "data-q-custom-1774628384633-1774628384655": {
            "title": "주요 학습 데이터 유형",
            "listItems": [
                "웹 텍스트(Common Crawl, 위키, 뉴스, 도서, 포럼)",
                "코드(공개 저장소)",
                "대화·채팅 로그",
            ],
        },
        "q-custom-1774628420201": {"question": "학습 데이터 품질은 LLM의 사실 정확도에 어떻게 영향을 주나요?"},
        "ans-q-custom-1774628420201-1774628420223": {
            "content": W(
                "잘못되거나 상충하는 데이터는 모델이 그대로 **암기**할 수 있습니다. "
                "출처 신뢰도·일관성·최신성이 부족하면 **환각** 위험이 커집니다. "
                "**쓰레기 입력 → 쓰레기 출력** 원칙이 LLM에도 해당합니다.",
            ),
            "extractedKeywords": [
                "사실 정확도",
                "데이터 품질",
                "환각",
                "일관성",
                "최신성",
            ],
            "suggestedQueries": [
                "개발자는 데이터 품질을 어떻게 높이나요?",
                "환각의 주요 원인은?",
            ],
        },
        "q-custom-1774628430385": {"question": "어떤 종류의 위치 인코딩이 사용되나요?"},
        "ans-q-custom-1774628430385-1774628430410": {
            "content": W(
                "**절대**: 사인·코사인, 학습된 위치 임베딩.\n"
                "**상대**: T5식 상대 바이어스, **RoPE**, **ALiBi**, **xPos** 등 주의 메커니즘에 직접 주입하는 방식이 많습니다.",
            ),
            "extractedKeywords": [
                "위치 인코딩",
                "절대·상대",
                "RoPE",
                "ALiBi",
                "T5",
            ],
            "suggestedQueries": [
                "사인·코사인 인코딩의 상세는?",
                "RoPE를 쓰는 모델은?",
            ],
        },
        "data-q-custom-1774628430385-1774628430410": {
            "title": "위치 인코딩 유형",
            "tableColumns": ["유형", "방법", "특징"],
            "tableRows": [
                {
                    "유형": "절대",
                    "방법": "사인·코사인",
                    "특징": "고정 함수, 임베딩에 가산",
                },
                {
                    "유형": "절대",
                    "방법": "학습",
                    "특징": "학습된 위치 행렬",
                },
                {
                    "유형": "상대",
                    "방법": "상대 위치 바이어스",
                    "특징": "거리에 따른 주의 바이어스",
                },
                {
                    "유형": "상대",
                    "방법": "RoPE",
                    "특징": "Q/K 회전, 내적에 상대 정보",
                },
                {
                    "유형": "상대",
                    "방법": "ALiBi",
                    "특징": "거리에 따른 선형 페널티",
                },
                {
                    "유형": "상대",
                    "방법": "xPos",
                    "특징": "RoPE 기반 장문 외삽",
                },
            ],
        },
        "q-custom-1774628452202": {"question": "절대 위치 인코딩과 상대 위치 인코딩의 주요 차이는?"},
        "ans-q-custom-1774628452202-1774628452227": {
            "content": W(
                "**절대**는 “몇 번째 토큰인가”를 임베딩에 더합니다. "
                "**상대**는 “두 토큰 사이 거리”를 주의에 직접 넣어 **더 긴 문맥 외삽**에 유리한 경우가 많습니다.",
            ),
            "extractedKeywords": [
                "절대 위치",
                "상대 위치",
                "주의 메커니즘",
                "외삽",
            ],
            "suggestedQueries": [
                "사인·코사인 절대 인코딩의 세부는?",
                "ALiBi의 장점은?",
            ],
        },
        "data-q-custom-1774628452202-1774628452227": {
            "title": "위치 인코딩 비교",
            "tableColumns": ["특징", "절대 위치 인코딩", "상대 위치 인코딩"],
            "tableRows": [
                {
                    "특징": "핵심 아이디어",
                    "절대 위치 인코딩": "각 위치에 고유 벡터",
                    "상대 위치 인코딩": "토큰 간 거리·관계",
                },
                {
                    "특징": "정보",
                    "절대 위치 인코딩": "‘어디’인지",
                    "상대 위치 인코딩": "‘얼마나 떨어졌는지’",
                },
                {
                    "특징": "결합",
                    "절대 위치 인코딩": "임베딩에 가산 후 레이어",
                    "상대 위치 인코딩": "주의 점수에 주입",
                },
                {
                    "특징": "일반화",
                    "절대 위치 인코딩": "학습 길이 밖은 어려울 수 있음",
                    "상대 위치 인코딩": "긴 시퀀스에 더 강건한 편",
                },
            ],
        },
    },
}


# --- Japanese (abbreviated parallel structure) ---
JA = {
    "keyword": "大規模言語モデル",
    "nodes": {
        "root": {"keyword": "大規模言語モデル"},
        "q-custom-1774628253903": {
            "question": "大規模言語モデル（LLM）の定義は何か、他のAIモデルとどう違うのか？"
        },
        "ans-q-custom-1774628253903-1774628253925": {
            "content": W(
                "**大規模言語モデル（LLM）**は人間の言語を理解・生成するために訓練されたニューラルネットです。"
                "「大規模」は数十億〜数兆の**パラメータ**と巨大な**テキストコーパス**で学習することを指します。",
                "中核は**次トークン予測**であり、多くが**Transformer**アーキテクチャです。"
                "狭いタスク特化モデルと比べ、要約・翻訳・コード生成など**汎用言語タスク**に強い点が特徴です。",
            ),
            "extractedKeywords": [
                "大規模言語モデル",
                "パラメータ",
                "学習データ",
                "Transformer",
                "次トークン予測",
                "汎用性",
                "創発的能力",
            ],
            "suggestedQueries": [
                "Transformerはどう動くのか？",
                "LLMに見られる創発的能力の例は？",
                "他のAIモデルの例をもっと知りたい",
            ],
        },
        "data-q-custom-1774628253903-1774628253925": {
            "title": "LLM vs その他のAIモデル",
            "tableColumns": ["観点", "大規模言語モデル（LLM）", "その他のAIモデル"],
            "tableRows": [
                {
                    "観点": "規模・汎用性",
                    "大規模言語モデル（LLM）": "非常に大きく言語タスク全般に汎用",
                    "その他のAIモデル": "小さく狭いタスクに特化",
                },
                {
                    "観点": "アーキテクチャ",
                    "大規模言語モデル（LLM）": "主にTransformer",
                    "その他のAIモデル": "CNNやRNNなど多様",
                },
                {
                    "観点": "データ種別",
                    "大規模言語モデル（LLM）": "主にテキスト・コード",
                    "その他のAIモデル": "画像・音声・数値など",
                },
                {
                    "観点": "能力",
                    "大規模言語モデル（LLM）": "推論など創発的傾向",
                    "その他のAIモデル": "タスク特化、広い創発は限定的",
                },
            ],
        },
        "q-custom-1774628275054": {"question": "Transformerアーキテクチャは基本的にどう動くのか？"},
        "ans-q-custom-1774628275054-1774628275069": {
            "content": W(
                "Transformerは**自己注意**で系列全体の文脈を捉えます。"
                "エンコーダが入力を表現し、デコーダが出力を生成します（多くのLLMはデコーダのみ）。",
            ),
            "extractedKeywords": ["Transformer", "自己注意", "マルチヘッド", "位置エンコーディング"],
            "suggestedQueries": ["QKVの計算", "位置エンコーディングの種類"],
        },
        "q-custom-1774628291934": {"question": "LLMが示した創発的能力の具体例は？"},
        "ans-q-custom-1774628291934-1774628291947": {
            "content": W(
                "文脈内学習、チェーン・オブ・ソート推論、指示追従、ツール利用、数学・コードなどが挙げられます。",
            ),
            "extractedKeywords": ["創発", "文脈内学習", "CoT", "ツール利用"],
            "suggestedQueries": ["創発の測定方法", "スケールとの関係"],
        },
        "data-q-custom-1774628291934-1774628291947": {
            "title": "主な創発的能力",
            "listItems": [
                "文脈内学習",
                "チェーン・オブ・ソート推論",
                "指示追従",
                "ツール利用",
                "数学問題",
                "コード生成・理解",
            ],
        },
        "q-custom-1774628312786": {"question": "どの種類の位置エンコーディングが使われるか？"},
        "ans-q-custom-1774628312786-1774628312802": {
            "content": W(
                "絶対（正弦・余弦、学習済み）、相対（距離に基づくバイアス）、RoPEなどがあります。",
            ),
            "extractedKeywords": ["位置エンコーディング", "RoPE", "相対・絶対"],
            "suggestedQueries": ["トークン埋め込みへの加算方法"],
        },
        "q-custom-1774628340570": {"question": "Q・K・Vベクトルは詳しくどう計算されるか？"},
        "ans-q-custom-1774628340570-1774628340590": {
            "content": W(
                "埋め込みXに学習行列WQ, WK, WVを掛けてQ, K, Vを得ます。",
            ),
            "extractedKeywords": ["QKV", "線形変換", "注意機構"],
            "suggestedQueries": ["注意スコアの計算"],
        },
        "data-q-custom-1774628340570-1774628340590": {
            "title": "QKV計算の要約",
            "tableColumns": ["ベクトル", "計算", "入力", "重み行列", "出力"],
            "tableRows": [
                {
                    "ベクトル": "Query (Q)",
                    "計算": "X · WQ",
                    "入力": "埋め込み X",
                    "重み行列": "WQ",
                    "出力": "クエリ",
                },
                {
                    "ベクトル": "Key (K)",
                    "計算": "X · WK",
                    "入力": "埋め込み X",
                    "重み行列": "WK",
                    "出力": "キー",
                },
                {
                    "ベクトル": "Value (V)",
                    "計算": "X · WV",
                    "入力": "埋め込み X",
                    "重み行列": "WV",
                    "出力": "バリュー",
                },
            ],
        },
        "q-custom-1774628361601": {"question": "正弦位置エンコーディングの数学的直感は？"},
        "ans-q-custom-1774628361601-1774628361623": {
            "content": W(
                "各次元で異なる周波数の波として位置を符号化し、三角恒等式で相対位置情報を扱いやすくします。",
            ),
            "extractedKeywords": ["正弦・余弦", "相対位置", "周波数"],
            "suggestedQueries": ["代替の位置エンコーディング"],
        },
        "q-custom-1774628367568": {"question": "LLMが最もよく使われる実世界の用途は？"},
        "ans-q-custom-1774628367568-1774628367589": {
            "content": W(
                "コンテンツ生成、カスタマーサポート、意味検索・要約、翻訳、コード支援、教育、医療文書、分析レポートなど。",
            ),
            "extractedKeywords": ["応用", "チャットボット", "意味検索", "コード"],
            "suggestedQueries": ["具体例をもっと"],
        },
        "data-q-custom-1774628367568-1774628367589": {
            "title": "よくあるLLM応用",
            "listItems": [
                "コンテンツ生成",
                "カスタマーサポート",
                "検索・要約",
                "翻訳・ローカライズ",
                "コード生成・デバッグ",
                "教育",
                "医療（研究段階）",
                "データ分析",
            ],
        },
        "q-custom-1774628384633": {"question": "LLMはどんなデータで訓練され、性能にどう影響するか？"},
        "ans-q-custom-1774628384633-1774628384655": {
            "content": W(
                "ウェブテキスト、コード、対話ログなど。多様性・規模・品質が知識と文体を形作り、バイアスも反映されます。",
            ),
            "extractedKeywords": ["訓練データ", "ウェブ", "バイアス"],
            "suggestedQueries": ["品質と事実性"],
        },
        "data-q-custom-1774628384633-1774628384655": {
            "title": "主な訓練データの種類",
            "listItems": [
                "ウェブテキスト（Common Crawl、ウィキ、ニュース等）",
                "コード（公開リポジトリ）",
                "対話データ",
            ],
        },
        "q-custom-1774628420201": {"question": "訓練データの品質はLLMの事実正確性にどう影響するか？"},
        "ans-q-custom-1774628420201-1774628420223": {
            "content": W(
                "誤情報や矛盾はモデルに取り込まれ、幻覚のリスクが高まります。Garbage in, garbage outが当てはまります。",
            ),
            "extractedKeywords": ["品質", "幻覚", "信頼性"],
            "suggestedQueries": ["データフィルタリング"],
        },
        "q-custom-1774628430385": {"question": "どの種類の位置エンコーディングが使われるか？"},
        "ans-q-custom-1774628430385-1774628430410": {
            "content": W(
                "絶対（正弦、学習済み）、相対（T5バイアス、RoPE、ALiBi、xPosなど）。",
            ),
            "extractedKeywords": ["位置エンコーディング", "RoPE", "ALiBi"],
            "suggestedQueries": ["RoPEを使うモデル"],
        },
        "data-q-custom-1774628430385-1774628430410": {
            "title": "位置エンコーディングの種類",
            "tableColumns": ["種類", "方法", "特徴"],
            "tableRows": [
                {"種類": "絶対", "方法": "正弦・余弦", "特徴": "固定関数"},
                {"種類": "絶対", "方法": "学習", "特徴": "埋め込み行列"},
                {"種類": "相対", "方法": "相対バイアス", "特徴": "距離に応じたバイアス"},
                {"種類": "相対", "方法": "RoPE", "特徴": "Q/K回転"},
                {"種類": "相対", "方法": "ALiBi", "特徴": "線形ペナルティ"},
                {"種類": "相対", "方法": "xPos", "特徴": "長文外挿"},
            ],
        },
        "q-custom-1774628452202": {"question": "絶対と相対の位置エンコーディングの主な違いは？"},
        "ans-q-custom-1774628452202-1774628452227": {
            "content": W(
                "絶対は「何番目か」、相対は「どれだけ離れているか」を重視し、長い系列への一般化に有利なことが多いです。",
            ),
            "extractedKeywords": ["絶対", "相対", "注意"],
            "suggestedQueries": ["実装の複雑さ"],
        },
        "data-q-custom-1774628452202-1774628452227": {
            "title": "位置エンコーディングの比較",
            "tableColumns": ["特徴", "絶対", "相対"],
            "tableRows": [
                {"特徴": "核となる考え", "絶対": "位置ごとのベクトル", "相対": "トークン間の距離"},
                {"特徴": "情報", "絶対": "どこか", "相対": "どれだけ離れたか"},
            ],
        },
    },
}


# --- Spanish ---
ES = {
    "keyword": "Modelos de lenguaje grandes",
    "nodes": {
        "root": {"keyword": "Modelos de lenguaje grandes"},
        "q-custom-1774628253903": {
            "question": "¿Qué define un modelo de lenguaje grande y en qué se diferencia de otros modelos de IA?"
        },
        "ans-q-custom-1774628253903-1774628253925": {
            "content": W(
                "Un **modelo de lenguaje grande (LLM)** aprende patrones del lenguaje a escala masiva (miles de millones de parámetros y enormes corpus).",
                "A diferencia de modelos estrechos, suele ser **generalista** en tareas de texto y se basa sobre todo en la arquitectura **Transformer**.",
            ),
            "extractedKeywords": [
                "LLM",
                "parámetros",
                "datos de entrenamiento",
                "Transformer",
                "siguiente token",
                "generalidad",
            ],
            "suggestedQueries": [
                "¿Cómo funciona un Transformer?",
                "¿Ejemplos de capacidades emergentes?",
            ],
        },
        "data-q-custom-1774628253903-1774628253925": {
            "title": "LLM frente a otros modelos de IA",
            "tableColumns": ["Aspecto", "Modelos de lenguaje grandes (LLM)", "Otros modelos de IA"],
            "tableRows": [
                {
                    "Aspecto": "Escala y generalidad",
                    "Modelos de lenguaje grandes (LLM)": "Gran escala, propósito general en lenguaje",
                    "Otros modelos de IA": "Más pequeños y especializados",
                },
                {
                    "Aspecto": "Arquitectura",
                    "Modelos de lenguaje grandes (LLM)": "Principalmente Transformer",
                    "Otros modelos de IA": "CNN, RNN, etc.",
                },
                {
                    "Aspecto": "Tipo de datos",
                    "Modelos de lenguaje grandes (LLM)": "Texto y código",
                    "Otros modelos de IA": "Imagen, audio, números…",
                },
                {
                    "Aspecto": "Capacidades",
                    "Modelos de lenguaje grandes (LLM)": "Razonamiento emergente (a veces)",
                    "Otros modelos de IA": "Específicas de la tarea",
                },
            ],
        },
        "q-custom-1774628275054": {
            "question": "¿Cómo funciona fundamentalmente la arquitectura Transformer?"
        },
        "ans-q-custom-1774628275054-1774628275069": {
            "content": W(
                "El Transformer usa **atención propia** para relacionar todos los tokens en paralelo. "
                "Q, K y V proyectan el embedding; las puntuaciones de atención ponderan los valores.",
            ),
            "extractedKeywords": ["Transformer", "atención", "multi-cabeza", "codificación posicional"],
            "suggestedQueries": ["Cálculo de Q, K, V", "Tipos de codificación posicional"],
        },
        "q-custom-1774628291934": {
            "question": "¿Qué ejemplos concretos de capacidades emergentes han mostrado los LLM?"
        },
        "ans-q-custom-1774628291934-1774628291947": {
            "content": W(
                "Aprendizaje en contexto, cadena de pensamiento, seguimiento de instrucciones, uso de herramientas, matemáticas y código.",
            ),
            "extractedKeywords": ["emergencia", "CoT", "herramientas"],
            "suggestedQueries": ["Cómo se miden estas capacidades"],
        },
        "data-q-custom-1774628291934-1774628291947": {
            "title": "Capacidades emergentes clave",
            "listItems": [
                "Aprendizaje en contexto",
                "Razonamiento cadena de pensamiento",
                "Seguimiento de instrucciones",
                "Uso de herramientas",
                "Matemáticas",
                "Código",
            ],
        },
        "q-custom-1774628312786": {"question": "¿Qué tipos de codificaciones posicionales se usan?"},
        "ans-q-custom-1774628312786-1774628312802": {
            "content": W(
                "Absolutas (seno/coseno, aprendidas) y relativas (RoPE, ALiBi, sesgos de T5, etc.).",
            ),
            "extractedKeywords": ["posicional", "RoPE", "relativa"],
            "suggestedQueries": ["RoPE en detalle"],
        },
        "q-custom-1774628340570": {"question": "¿Cómo se calculan en detalle los vectores Q, K y V?"},
        "ans-q-custom-1774628340570-1774628340590": {
            "content": W(
                "Q = X·WQ, K = X·WK, V = X·WV a partir del embedding X y matrices aprendidas.",
            ),
            "extractedKeywords": ["QKV", "proyección lineal"],
            "suggestedQueries": ["Puntuaciones de atención"],
        },
        "data-q-custom-1774628340570-1774628340590": {
            "title": "Resumen del cálculo QKV",
            "tableColumns": ["Vector", "Cálculo", "Entrada", "Matriz", "Salida"],
            "tableRows": [
                {
                    "Vector": "Query (Q)",
                    "Cálculo": "X · WQ",
                    "Entrada": "Embedding X",
                    "Matriz": "WQ",
                    "Salida": "Vector Q",
                },
                {
                    "Vector": "Key (K)",
                    "Cálculo": "X · WK",
                    "Entrada": "Embedding X",
                    "Matriz": "WK",
                    "Salida": "Vector K",
                },
                {
                    "Vector": "Value (V)",
                    "Cálculo": "X · WV",
                    "Entrada": "Embedding X",
                    "Matriz": "WV",
                    "Salida": "Vector V",
                },
            ],
        },
        "q-custom-1774628361601": {
            "question": "¿Cuál es la intuición matemática detrás de la codificación posicional sinusoidal?"
        },
        "ans-q-custom-1774628361601-1774628361623": {
            "content": W(
                "Ondas de distintas frecuencias codifican la posición; identidades trigonométricas ayudan a la información relativa.",
            ),
            "extractedKeywords": ["sinusoidal", "relativa", "frecuencia"],
            "suggestedQueries": ["Alternativas"],
        },
        "q-custom-1774628367568": {
            "question": "¿Cuáles son los usos más comunes de los LLM en el mundo real?"
        },
        "ans-q-custom-1774628367568-1774628367589": {
            "content": W(
                "Generación de contenido, soporte al cliente, búsqueda semántica, traducción, asistencia de código, educación, salud (investigación), análisis.",
            ),
            "extractedKeywords": ["aplicaciones", "chatbots", "búsqueda"],
            "suggestedQueries": ["Ejemplos en atención al cliente"],
        },
        "data-q-custom-1774628367568-1774628367589": {
            "title": "Aplicaciones frecuentes de LLM",
            "listItems": [
                "Generación de contenido",
                "Atención al cliente",
                "Recuperación y resumen",
                "Traducción",
                "Código",
                "Educación",
                "Salud",
                "Análisis de datos",
            ],
        },
        "q-custom-1774628384633": {
            "question": "¿Con qué datos se entrenan los LLM y por qué importa para su rendimiento?"
        },
        "ans-q-custom-1774628384633-1774628384655": {
            "content": W(
                "Texto web, código y diálogos. La diversidad y calidad moldean conocimiento y sesgos.",
            ),
            "extractedKeywords": ["datos", "sesgo", "cobertura"],
            "suggestedQueries": ["Ética de recolección"],
        },
        "data-q-custom-1774628384633-1774628384655": {
            "title": "Tipos principales de datos de entrenamiento",
            "listItems": [
                "Texto web (Common Crawl, Wikipedia, noticias…)",
                "Código (repositorios públicos)",
                "Datos conversacionales",
            ],
        },
        "q-custom-1774628420201": {
            "question": "¿Cómo afecta la calidad de los datos de entrenamiento a la exactitud factual de un LLM?"
        },
        "ans-q-custom-1774628420201-1774628420223": {
            "content": W(
                "Errores y conflictos en los datos se reflejan en salidas; riesgo de alucinaciones. Basura entra, basura sale.",
            ),
            "extractedKeywords": ["calidad", "alucinación"],
            "suggestedQueries": ["Filtrado de datos"],
        },
        "q-custom-1774628430385": {"question": "¿Qué tipos de codificaciones posicionales se usan?"},
        "ans-q-custom-1774628430385-1774628430410": {
            "content": W(
                "Absolutas y relativas: seno/coseno, aprendidas, sesgos relativos, RoPE, ALiBi, xPos…",
            ),
            "extractedKeywords": ["posicional", "RoPE"],
            "suggestedQueries": ["ALiBi"],
        },
        "data-q-custom-1774628430385-1774628430410": {
            "title": "Tipos de codificaciones posicionales",
            "tableColumns": ["Tipo", "Método", "Característica"],
            "tableRows": [
                {"Tipo": "Absoluta", "Método": "Seno y coseno", "Característica": "Funciones fijas"},
                {"Tipo": "Absoluta", "Método": "Aprendida", "Característica": "Matriz de posición"},
                {"Tipo": "Relativa", "Método": "Sesgos", "Característica": "Según distancia"},
                {"Tipo": "Relativa", "Método": "RoPE", "Característica": "Rotación Q/K"},
                {"Tipo": "Relativa", "Método": "ALiBi", "Característica": "Penalización lineal"},
                {"Tipo": "Relativa", "Método": "xPos", "Característica": "Extrapolación larga"},
            ],
        },
        "q-custom-1774628452202": {
            "question": "¿Cuáles son las diferencias principales entre codificaciones posicionales absolutas y relativas?"
        },
        "ans-q-custom-1774628452202-1774628452227": {
            "content": W(
                "Las absolutas codifican el índice; las relativas la distancia entre tokens, a menudo mejor para secuencias largas.",
            ),
            "extractedKeywords": ["absoluta", "relativa"],
            "suggestedQueries": ["Sinusoidal en detalle"],
        },
        "data-q-custom-1774628452202-1774628452227": {
            "title": "Comparación de codificaciones posicionales",
            "tableColumns": ["Característica", "Absoluta", "Relativa"],
            "tableRows": [
                {"Característica": "Idea central", "Absoluta": "Vector por posición", "Relativa": "Distancia entre tokens"},
                {"Característica": "Información", "Absoluta": "Dónde", "Relativa": "Qué tan lejos"},
            ],
        },
    },
}


# --- Simplified Chinese ---
ZH = {
    "keyword": "大语言模型",
    "nodes": {
        "root": {"keyword": "大语言模型"},
        "q-custom-1774628253903": {
            "question": "什么是大语言模型（LLM），它与其他 AI 模型有何不同？"
        },
        "ans-q-custom-1774628253903-1774628253925": {
            "content": W(
                "**大语言模型（LLM）**通过海量参数与文本数据学习语言规律，核心通常是**预测下一个词元**，架构多为 **Transformer**。",
                "与面向单一窄任务的模型相比，LLM更偏**通用语言任务**（摘要、翻译、代码等）。",
            ),
            "extractedKeywords": ["大语言模型", "参数", "训练数据", "Transformer", "下一词预测", "通用性"],
            "suggestedQueries": ["Transformer 如何工作？", "有哪些涌现能力例子？"],
        },
        "data-q-custom-1774628253903-1774628253925": {
            "title": "LLM 与其他 AI 模型",
            "tableColumns": ["方面", "大语言模型（LLM）", "其他 AI 模型"],
            "tableRows": [
                {
                    "方面": "规模与通用性",
                    "大语言模型（LLM）": "规模大，面向多种语言任务",
                    "其他 AI 模型": "更小、更专精",
                },
                {
                    "方面": "架构",
                    "大语言模型（LLM）": "主要为 Transformer",
                    "其他 AI 模型": "CNN、RNN 等各异",
                },
                {
                    "方面": "数据类型",
                    "大语言模型（LLM）": "以文本、代码为主",
                    "其他 AI 模型": "图像、音频、数值等",
                },
                {
                    "方面": "能力",
                    "大语言模型（LLM）": "可出现推理等涌现行为",
                    "其他 AI 模型": "任务专用",
                },
            ],
        },
        "q-custom-1774628275054": {"question": "Transformer 架构本质上如何工作？"},
        "ans-q-custom-1774628275054-1774628275069": {
            "content": W(
                "Transformer 用**自注意力**并行关联序列中所有词元，再由前馈层等处理；编码器—解码器或仅解码器结构常见于生成模型。",
            ),
            "extractedKeywords": ["Transformer", "自注意力", "多头", "位置编码"],
            "suggestedQueries": ["Q、K、V 如何计算"],
        },
        "q-custom-1774628291934": {"question": "LLM 展现了哪些涌现能力的具体例子？"},
        "ans-q-custom-1774628291934-1774628291947": {
            "content": W(
                "上下文学习、思维链推理、指令跟随、工具使用、数学与代码等。",
            ),
            "extractedKeywords": ["涌现", "上下文学习", "思维链"],
            "suggestedQueries": ["如何衡量涌现能力"],
        },
        "data-q-custom-1774628291934-1774628291947": {
            "title": "主要涌现能力",
            "listItems": [
                "上下文学习",
                "思维链推理",
                "指令跟随",
                "工具使用",
                "数学解题",
                "代码生成与理解",
            ],
        },
        "q-custom-1774628312786": {"question": "使用哪些类型的位置编码？"},
        "ans-q-custom-1774628312786-1774628312802": {
            "content": W(
                "绝对位置（正弦/余弦、可学习）与相对位置（如 RoPE、ALiBi、相对偏置等）。",
            ),
            "extractedKeywords": ["位置编码", "RoPE", "相对/绝对"],
            "suggestedQueries": ["与词嵌入如何相加"],
        },
        "q-custom-1774628340570": {"question": "Q、K、V 向量具体如何计算？"},
        "ans-q-custom-1774628340570-1774628340590": {
            "content": W(
                "对词嵌入 X 分别乘以可学习的 WQ、WK、WV 得到 Q、K、V。",
            ),
            "extractedKeywords": ["QKV", "线性变换"],
            "suggestedQueries": ["注意力分数"],
        },
        "data-q-custom-1774628340570-1774628340590": {
            "title": "QKV 计算摘要",
            "tableColumns": ["向量", "计算", "输入", "权重矩阵", "输出"],
            "tableRows": [
                {
                    "向量": "Query (Q)",
                    "计算": "X · WQ",
                    "输入": "嵌入 X",
                    "权重矩阵": "WQ",
                    "输出": "查询向量",
                },
                {
                    "向量": "Key (K)",
                    "计算": "X · WK",
                    "输入": "嵌入 X",
                    "权重矩阵": "WK",
                    "输出": "键向量",
                },
                {
                    "向量": "Value (V)",
                    "计算": "X · WV",
                    "输入": "嵌入 X",
                    "权重矩阵": "WV",
                    "输出": "值向量",
                },
            ],
        },
        "q-custom-1774628361601": {"question": "正弦位置编码的数学直觉是什么？"},
        "ans-q-custom-1774628361601-1774628361623": {
            "content": W(
                "不同频率的正弦/余弦为每个位置生成唯一向量，三角恒等式有助于表达相对位置关系。",
            ),
            "extractedKeywords": ["正弦编码", "相对位置"],
            "suggestedQueries": ["其他位置编码方法"],
        },
        "q-custom-1774628367568": {"question": "大语言模型最常见的实际应用有哪些？"},
        "ans-q-custom-1774628367568-1774628367589": {
            "content": W(
                "内容生成、客服机器人、语义搜索与摘要、翻译、代码辅助、教育、医疗文档（研究）、商业分析等。",
            ),
            "extractedKeywords": ["应用", "语义搜索", "代码"],
            "suggestedQueries": ["客服场景案例"],
        },
        "data-q-custom-1774628367568-1774628367589": {
            "title": "常见 LLM 应用",
            "listItems": [
                "内容生成",
                "客服与支持",
                "检索与摘要",
                "翻译与本地化",
                "代码生成与调试",
                "个性化教育",
                "医疗（研究阶段）",
                "数据分析",
            ],
        },
        "q-custom-1774628384633": {"question": "LLM 用哪些数据训练，为何对性能重要？"},
        "ans-q-custom-1774628384633-1774628384655": {
            "content": W(
                "网络文本、代码、对话等。多样性、规模与质量决定知识与风格，也带来偏差风险。",
            ),
            "extractedKeywords": ["训练数据", "网络文本", "偏差"],
            "suggestedQueries": ["数据伦理"],
        },
        "data-q-custom-1774628384633-1774628384655": {
            "title": "主要训练数据类型",
            "listItems": [
                "网络文本（Common Crawl、维基、新闻等）",
                "代码（公开仓库）",
                "对话数据",
            ],
        },
        "q-custom-1774628420201": {"question": "训练数据质量如何影响 LLM 的事实准确性？"},
        "ans-q-custom-1774628420201-1774628420223": {
            "content": W(
                "错误与矛盾会被模型吸收，增加幻觉风险；垃圾进、垃圾出同样适用。",
            ),
            "extractedKeywords": ["质量", "幻觉"],
            "suggestedQueries": ["数据清洗方法"],
        },
        "q-custom-1774628430385": {"question": "使用哪些类型的位置编码？"},
        "ans-q-custom-1774628430385-1774628430410": {
            "content": W(
                "绝对（正弦、可学习）与相对（T5 偏置、RoPE、ALiBi、xPos 等）。",
            ),
            "extractedKeywords": ["位置编码", "RoPE"],
            "suggestedQueries": ["RoPE 优势"],
        },
        "data-q-custom-1774628430385-1774628430410": {
            "title": "位置编码类型",
            "tableColumns": ["类型", "方法", "特点"],
            "tableRows": [
                {"类型": "绝对", "方法": "正弦/余弦", "特点": "固定函数"},
                {"类型": "绝对", "方法": "可学习", "特点": "位置嵌入矩阵"},
                {"类型": "相对", "方法": "相对偏置", "特点": "按距离调整注意力"},
                {"类型": "相对", "方法": "RoPE", "特点": "旋转 Q/K"},
                {"类型": "相对", "方法": "ALiBi", "特点": "线性距离惩罚"},
                {"类型": "相对", "方法": "xPos", "特点": "长序列外推"},
            ],
        },
        "q-custom-1774628452202": {"question": "绝对与相对位置编码的主要区别？"},
        "ans-q-custom-1774628452202-1774628452227": {
            "content": W(
                "绝对编码“第几个词”；相对编码强调词间距离，往往更利于长序列泛化。",
            ),
            "extractedKeywords": ["绝对", "相对"],
            "suggestedQueries": ["实现复杂度"],
        },
        "data-q-custom-1774628452202-1774628452227": {
            "title": "位置编码比较",
            "tableColumns": ["特征", "绝对位置编码", "相对位置编码"],
            "tableRows": [
                {"特征": "核心思想", "绝对位置编码": "每个位置一个向量", "相对位置编码": "词与词之间的距离"},
                {"特征": "信息", "绝对位置编码": "在哪里", "相对位置编码": "多远"},
            ],
        },
    },
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, patch in [("ko", KO), ("ja", JA), ("es", ES), ("zh", ZH)]:
        path = OUT / f"service-intro.{name}.json"
        with path.open("w", encoding="utf-8") as f:
            json.dump(patch, f, ensure_ascii=False, indent=2)
        print("wrote", path)


if __name__ == "__main__":
    main()
