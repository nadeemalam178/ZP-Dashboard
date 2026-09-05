import streamlit as st
import pandas as pd
import warnings

# Suppress pandas openpyxl warning
warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')

st.set_page_config(page_title="ZP Dashboard - Live Google Sheets", layout="wide")

@st.cache_data(ttl=30)
def load_data():
    urls = [
        'https://docs.google.com/spreadsheets/d/1ZtME2kaltetF-VNuuH4NATAHx6qSsxFkbZ5fSPSG-CM/export?format=xlsx',
        'https://docs.google.com/spreadsheets/d/1ebxTaRpQOgCNWm2mpwk4qSviNiM4c_HAZX-xuiumlYA/export?format=xlsx'
    ]
    
    cand_dfs = []
    pk_dfs = []
    
    # Strictly fetch both Google Sheets live
    for url in urls:
        try:
            df_c = pd.read_excel(url, sheet_name='Final Candidate')
            cand_dfs.append(df_c)
        except Exception as e:
            st.error(f"Error fetching Final Candidate from live sheet: {e}")
        try:
            df_p = pd.read_excel(url, sheet_name='Gap Report')
            pk_dfs.append(df_p)
        except Exception:
            try:
                df_p = pd.read_excel(url, sheet_name='PK Review Report', header=1)
                pk_dfs.append(df_p)
            except Exception:
                pass

    df_candidates = pd.concat(cand_dfs, ignore_index=True) if cand_dfs else pd.DataFrame()
    df_pk = pd.concat(pk_dfs, ignore_index=True) if pk_dfs else pd.DataFrame()
        
    return df_candidates, df_pk

df_candidates, df_pk = load_data()

st.title("ZP Candidate Dashboard (Live Google Sheets)")

if df_candidates.empty:
    st.error("No data fetched from Google Sheets. Please verify connection and refresh.")
    st.stop()

# --- Sidebar Filters ---
st.sidebar.header("Filters (Multi-Select)")

if st.sidebar.button("🔄 Sync Live Google Sheets"):
    st.cache_data.clear()
    st.rerun()

# Convert to string to avoid issues with mixed types
df_candidates['Zone'] = df_candidates['Zone'].astype(str).str.strip()
df_candidates['District'] = df_candidates['District'].astype(str).str.strip()
df_candidates['PC'] = df_candidates['PC'].astype(str).str.strip()
df_candidates['AC'] = df_candidates['AC'].astype(str).str.strip()
df_candidates['Block'] = df_candidates['Block'].astype(str).str.strip()

# Multi-select filters
zones = sorted([z for z in df_candidates['Zone'].unique() if z and z != 'nan'])
selected_zones = st.sidebar.multiselect("Select Zone(s)", zones, default=[])

df_z = df_candidates if not selected_zones else df_candidates[df_candidates['Zone'].isin(selected_zones)]
districts = sorted([d for d in df_z['District'].unique() if d and d != 'nan'])
selected_districts = st.sidebar.multiselect("Select District(s)", districts, default=[])

df_d = df_z if not selected_districts else df_z[df_z['District'].isin(selected_districts)]
pcs = sorted([p for p in df_d['PC'].unique() if p and p != 'nan'])
selected_pcs = st.sidebar.multiselect("Select PC(s)", pcs, default=[])

df_pc = df_d if not selected_pcs else df_d[df_d['PC'].isin(selected_pcs)]
acs = sorted([a for a in df_pc['AC'].unique() if a and a != 'nan'])
selected_acs = st.sidebar.multiselect("Select AC(s)", acs, default=[])

df_ac = df_pc if not selected_acs else df_pc[df_pc['AC'].isin(selected_acs)]
blocks = sorted([b for b in df_ac['Block'].unique() if b and b != 'nan'])
selected_blocks = st.sidebar.multiselect("Select Block(s)", blocks, default=[])

# Universal Search
search_query = st.sidebar.text_input("🔍 Universal Search (English / हिंदी)", placeholder="Candidate, Chairman, Seat, Phone...")

# --- Apply Filters ---
filtered_candidates = df_candidates.copy()

if search_query:
    sq = search_query.strip().lower()
    # Search across all columns
    mask = filtered_candidates.apply(lambda row: row.astype(str).str.lower().str.contains(sq).any(), axis=1)
    filtered_candidates = filtered_candidates[mask]

if selected_zones:
    filtered_candidates = filtered_candidates[filtered_candidates['Zone'].isin(selected_zones)]
if selected_districts:
    filtered_candidates = filtered_candidates[filtered_candidates['District'].isin(selected_districts)]
if selected_pcs:
    filtered_candidates = filtered_candidates[filtered_candidates['PC'].isin(selected_pcs)]
if selected_acs:
    filtered_candidates = filtered_candidates[filtered_candidates['AC'].isin(selected_acs)]
if selected_blocks:
    filtered_candidates = filtered_candidates[filtered_candidates['Block'].isin(selected_blocks)]

# --- KPIs from PK Review Report ---
st.header("KPIs")
pk_filtered = df_pk.copy()

# Filter PK report based on selection
if selected_zones:
    pk_filtered = pk_filtered[pk_filtered['Zone'].isin(selected_zones)]
if selected_districts:
    pk_filtered = pk_filtered[pk_filtered['District'].isin(selected_districts)]

# Only calculate sum if we have numeric data
if not pk_filtered.empty:
    # Filter out the "Total" row if it exists
    pk_filtered = pk_filtered[~pk_filtered['Zone'].astype(str).str.contains('Total', na=False)]
    
    col1, col2, col3, col4 = st.columns(4)
    
    try:
        # Convert to numeric, replacing non-numeric with NaN then sum
        total_seats = pd.to_numeric(pk_filtered['Number of ZP Seats'], errors='coerce').sum()
        unique_candidates = pd.to_numeric(pk_filtered['Unique Candidates Identified  (Atleast One Candidates)'], errors='coerce').sum()
        gap = pd.to_numeric(pk_filtered['Gap (Seat Wise Atleast One Candidates not Identified )'], errors='coerce').sum()
        total_identified = pd.to_numeric(pk_filtered['Total Candidate Identified'], errors='coerce').sum()
        
        col1.metric("Total ZP Seats", f"{int(total_seats)}")
        col2.metric("Unique Candidates Identified", f"{int(unique_candidates)}")
        col3.metric("Gap (Not Identified)", f"{int(gap)}")
        col4.metric("Total Candidates Identified", f"{int(total_identified)}")
    except Exception as e:
        st.warning(f"Could not load some metrics: {e}")

# --- Data Table ---
st.header("Candidates")
st.dataframe(filtered_candidates, use_container_width=True)
