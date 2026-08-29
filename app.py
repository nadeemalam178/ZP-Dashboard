import streamlit as st
import pandas as pd
import warnings

# Suppress pandas openpyxl warning
warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')

st.set_page_config(page_title="ZP Dashboard", layout="wide")

@st.cache_data(ttl=60)
def load_data():
    url = 'https://docs.google.com/spreadsheets/d/1ZtME2kaltetF-VNuuH4NATAHx6qSsxFkbZ5fSPSG-CM/export?format=xlsx'
    
    # Load Final Candidate
    try:
        df_candidates = pd.read_excel(url, sheet_name='Final Candidate')
    except Exception as e:
        st.error(f"Error loading Final Candidate tab: {e}")
        df_candidates = pd.DataFrame()
        
    # Load PK Review Report
    try:
        df_pk = pd.read_excel(url, sheet_name='PK Review Report', header=1)
    except Exception as e:
        st.error(f"Error loading PK Review Report tab: {e}")
        df_pk = pd.DataFrame()
        
    return df_candidates, df_pk

df_candidates, df_pk = load_data()

st.title("ZP Candidate Dashboard")

if df_candidates.empty or df_pk.empty:
    st.stop()

# --- Sidebar Filters ---
st.sidebar.header("Filters")

if st.sidebar.button("Refresh Data"):
    st.cache_data.clear()
    st.rerun()

# Convert to string to avoid issues with mixed types
df_candidates['Zone'] = df_candidates['Zone'].astype(str)
df_candidates['District'] = df_candidates['District'].astype(str)
df_candidates['PC'] = df_candidates['PC'].astype(str)
df_candidates['AC'] = df_candidates['AC'].astype(str)
df_candidates['Block'] = df_candidates['Block'].astype(str)

zones = sorted([z for z in df_candidates['Zone'].unique() if z != 'nan'])
selected_zone = st.sidebar.selectbox("Select Zone", ["All"] + zones)

if selected_zone != "All":
    districts = sorted([d for d in df_candidates[df_candidates['Zone'] == selected_zone]['District'].unique() if d != 'nan'])
else:
    districts = sorted([d for d in df_candidates['District'].unique() if d != 'nan'])
selected_district = st.sidebar.selectbox("Select District", ["All"] + districts)

if selected_district != "All":
    pcs = sorted([p for p in df_candidates[df_candidates['District'] == selected_district]['PC'].unique() if p != 'nan'])
else:
    pcs = sorted([p for p in df_candidates['PC'].unique() if p != 'nan'])
selected_pc = st.sidebar.selectbox("Select PC", ["All"] + pcs)

if selected_pc != "All":
    acs = sorted([a for a in df_candidates[df_candidates['PC'] == selected_pc]['AC'].unique() if a != 'nan'])
else:
    acs = sorted([a for a in df_candidates['AC'].unique() if a != 'nan'])
selected_ac = st.sidebar.selectbox("Select AC", ["All"] + acs)

if selected_ac != "All":
    blocks = sorted([b for b in df_candidates[df_candidates['AC'] == selected_ac]['Block'].unique() if b != 'nan'])
else:
    blocks = sorted([b for b in df_candidates['Block'].unique() if b != 'nan'])
selected_block = st.sidebar.selectbox("Select Block", ["All"] + blocks)


# --- Apply Filters ---
filtered_candidates = df_candidates.copy()

if selected_zone != "All":
    filtered_candidates = filtered_candidates[filtered_candidates['Zone'] == selected_zone]
if selected_district != "All":
    filtered_candidates = filtered_candidates[filtered_candidates['District'] == selected_district]
if selected_pc != "All":
    filtered_candidates = filtered_candidates[filtered_candidates['PC'] == selected_pc]
if selected_ac != "All":
    filtered_candidates = filtered_candidates[filtered_candidates['AC'] == selected_ac]
if selected_block != "All":
    filtered_candidates = filtered_candidates[filtered_candidates['Block'] == selected_block]

# --- KPIs from PK Review Report ---
st.header("KPIs")
pk_filtered = df_pk.copy()

# Filter PK report based on selection
if selected_zone != "All":
    pk_filtered = pk_filtered[pk_filtered['Zone'] == selected_zone]
if selected_district != "All":
    pk_filtered = pk_filtered[pk_filtered['District'] == selected_district]

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
