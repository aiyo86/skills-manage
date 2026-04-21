# Skills-Manage 系统架构图 (Mermaid 版本)

## 1. 整体架构图

```mermaid
graph TB
    User[用户浏览器] -->|HTTP:8888| Vite[Vite 开发服务器<br/>Port: 8888]
    
    subgraph Frontend["前端应用 (React + TypeScript)"]
        Vite --> PlatformStore[PlatformStore<br/>平台数据]
        Vite --> SkillStore[SkillStore<br/>技能列表]
        Vite --> CentralStore[CentralSkillsStore<br/>中央技能库]
        Vite --> DetailStore[SkillDetailStore<br/>技能详情+AI]
        Vite --> View[SkillDetailView<br/>UI展示]
    end
    
    Vite -->|/api/* 代理| Proxy[Vite 代理]
    Proxy -->|localhost:8891| API[API 服务器<br/>Port: 8891]
    
    subgraph Backend["后端服务 (Node.js + Express)"]
        API --> AgentsAPI[GET /api/agents<br/>平台列表]
        API --> ScanAPI[POST /api/scan<br/>扫描技能]
        API --> SkillsAPI[GET /api/skills/:agentId<br/>技能列表]
        API --> DetailAPI[GET /api/skill-detail/:id<br/>技能详情]
        API --> ContentAPI[GET /api/skill-content/:id<br/>技能内容]
        API --> ExplainAPI[POST /api/explain-skill<br/>AI解释]
    end
    
    API --> FS[文件系统访问<br/>fs.promises]
    API --> GLM[智谱 AI API<br/>GLM-5 模型]
    
    FS --> SkillsDir[~/.agents/skills/<br/>~/.claude/skills/<br/>~/.cursor/skills/<br/>~/.gemini/skills/]
    
    style User fill:#e1f5ff
    style Vite fill:#4caf50,color:#fff
    style API fill:#ff9800,color:#fff
    style GLM fill:#9c27b0,color:#fff
    style FS fill:#607d8b,color:#fff
```

## 2. 数据流向图 - 平台列表加载

```mermaid
sequenceDiagram
    participant U as 用户
    participant PS as PlatformStore
    participant V as Vite
    participant API as API 服务器
    participant FS as 文件系统
    
    U->>PS: 访问页面
    PS->>PS: isTauriRuntime()?
    
    alt Tauri 桌面版
        PS->>PS: invoke("get_agents")
    else Web 浏览器版
        PS->>V: fetch("/api/agents")
        V->>API: GET /api/agents
        API->>FS: detectPlatforms()
        FS-->>API: 检查各目录
        API-->>V: AgentWithStatus[]
        V-->>PS: JSON 响应
    end
    
    PS-->>U: 显示平台列表
```

## 3. 数据流向图 - 技能详情加载

```mermaid
sequenceDiagram
    participant U as 用户
    participant SDS as SkillDetailStore
    participant V as Vite
    participant API as API 服务器
    participant FS as 文件系统
    
    U->>SDS: 点击技能
    SDS->>SDS: loadDetail(skillId)
    
    par 并行请求
        SDS->>V: fetch("/api/skill-detail/:id")
        V->>API: GET /api/skill-detail/:id
        API->>FS: findSkillById()
        FS->>FS: 遍历平台目录<br/>查找技能<br/>解析 frontmatter
        FS-->>API: SkillDetail
        API-->>V: { detail }
        V-->>SDS: JSON
    and
        SDS->>V: fetch("/api/skill-content/:id")
        V->>API: GET /api/skill-content/:id
        API->>FS: 读取 SKILL.md
        FS-->>API: 文件内容
        API-->>V: { content }
        V-->>SDS: Text
    end
    
    SDS-->>U: 显示技能详情页面
    U->>U: Markdown 渲染<br/>安装状态显示
```

## 4. 数据流向图 - AI 解释生成

```mermaid
sequenceDiagram
    participant U as 用户
    participant SDS as SkillDetailStore
    participant V as Vite
    participant API as API 服务器
    participant GLM as 智谱 AI API
    
    U->>SDS: 点击"生成解释"
    SDS->>SDS: generateExplanation(skillId, content, lang)
    SDS->>SDS: isTauriRuntime()?
    
    alt Tauri 桌面版
        SDS->>SDS: invoke("explain_skill_stream")
    else Web 浏览器版
        SDS->>V: POST /api/explain-skill
        V->>API: POST /api/explain-skill<br/>{skillId, content, lang}
        
        API->>API: 构建提示词<br/>- 截取内容 (8000字符)<br/>- 添加指令模板
        
        API->>GLM: POST /api/paas/v4/chat/completions<br/>{model, messages}
        
        GLM-->>API: AI 解释文本
        API-->>V: { explanation }
        V-->>SDS: JSON
    end
    
    SDS-->>U: 显示 AI 解释<br/>- 一句话总结<br/>- 适用场景<br/>- 关键功能点
```

## 5. 网络拓扑图

```mermaid
graph LR
    Internet[外网用户] -->|47.88.27.90:8888| ECS[阿里云 ECS]
    
    subgraph ECS_Server["ECS 服务器"]
        ECS --> Vite[Vite :8888<br/>前端]
        Vite -->|代理| API[API :8891<br/>后端]
        
        API -->|读取| Files[本地文件系统]
        API -->|调用| AI[智谱 AI]
    end
    
    style Internet fill:#e3f2fd
    style ECS fill:#fff3e0
    style Vite fill:#4caf50,color:#fff
    style API fill:#ff9800,color:#fff
    style AI fill:#9c27b0,color:#fff
```

## 6. 技术栈组件图

```mermaid
graph TB
    subgraph Frontend["前端技术栈"]
        React[React 18]
        TS[TypeScript]
        Zustand[Zustand 状态管理]
        ViteBuild[Vite 6.4.2]
        Tailwind[TailwindCSS]
        UI[shadcn/ui]
        RM[react-markdown]
    end
    
    subgraph Backend["后端技术栈"]
        Node[Node.js]
        Express[Express]
        FS[fs.promises]
    end
    
    subgraph Services["外部服务"]
        GLM[智谱 GLM-5]
    end
    
    subgraph Data["数据存储"]
        Skills[SKILL.md 文件]
        Dirs[~/.agents/skills/<br/>~/.claude/skills/]
    end
    
    React --> TS
    React --> Zustand
    React --> ViteBuild
    ViteBuild --> Tailwind
    Tailwind --> UI
    React --> RM
    
    Node --> Express
    Express --> FS
    Express --> GLM
    
    FS --> Dirs
    Dirs --> Skills
    
    style Frontend fill:#e8f5e9
    style Backend fill:#fff3e0
    style Services fill:#f3e5f5
    style Data fill:#e3f2fd
```

## 7. 部署架构对比

```mermaid
graph TB
    subgraph Dev["当前开发环境"]
        DevVite[Vite 开发服务器<br/>:8888 直接暴露]
        DevAPI[API 服务器<br/>:8891 nohup 运行]
        DevVite -->|代理| DevAPI
    end
    
    subgraph Prod["建议生产环境"]
        Nginx[Nginx 反向代理<br/>:80/:443]
        ProdStatic[前端静态文件<br/>构建后]
        ProdAPI[API 服务器<br/>PM2 守护进程]
        
        Nginx --> ProdStatic
        Nginx --> ProdAPI
    end
    
    style Dev fill:#fff3e0
    style Prod fill:#e8f5e9
```

## 8. API 端点总览

```mermaid
graph TB
    API["/api/* 端点"] --> Agents["GET /api/agents<br/>获取平台列表"]
    API --> Scan["POST /api/scan<br/>扫描所有技能"]
    API --> Skills["GET /api/skills/:agentId<br/>获取平台技能列表"]
    API --> Detail["GET /api/skill-detail/:id<br/>获取技能详情"]
    API --> Content["GET /api/skill-content/:id<br/>获取 SKILL.md 内容"]
    API --> Explain["POST /api/explain-skill<br/>生成 AI 解释"]
    API --> ReadFile["GET /api/read-file<br/>读取文件"]
    
    Agents --> FS["文件系统"]
    Scan --> FS
    Skills --> FS
    Detail --> FS
    Content --> FS
    ReadFile --> FS
    Explain --> GLM["智谱 AI"]
    
    style API fill:#e1f5fe
    style FS fill:#cfd8dc
    style GLM fill:#ce93d8
```

---

**使用说明：**

1. 在 GitHub 上，Mermaid 图表会自动渲染
2. 在支持 Mermaid 的 Markdown 编辑器中也能正常显示
3. 可以使用 Mermaid Live Editor (https://mermaid.live) 编辑和导出图片
4. 推荐使用此版本进行文档分享和演示

**相关文件：**
- `/tmp/skills-manage/ARCHITECTURE.md` - 文本版本
- `/tmp/skills-manage/docs/ARCHITECTURE_MERMAID.md` - Mermaid 图表版本
