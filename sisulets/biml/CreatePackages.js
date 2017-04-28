// Create loading logic
var load, map, sql, i;
/*~
<Biml xmlns="http://schemas.varigence.com/biml.xsd">
    <Connections>
        <OleDbConnection Name="$VARIABLES.SourceDatabase" ConnectionString="Server=localhost;Initial Catalog=$VARIABLES.SourceDatabase;Integrated Security=SSPI;Provider=SQLNCLI11;" />
        <OleDbConnection Name="$VARIABLES.TargetDatabase" ConnectionString="Server=localhost;Initial Catalog=$VARIABLES.TargetDatabase;Integrated Security=SSPI;Provider=SQLNCLI11;" />
    </Connections>
    <Packages>
~*/
while(load = target.nextLoad()) {
/*~
        <Package Name="$load.qualified" ConstraintMode="Linear">
            <Tasks>
~*/
    if(sql = load.sql ? load.sql.before : null) {
/*~
                <ExecuteSQL Name="SQL Before" ConnectionName="$VARIABLES.SourceDatabase">
                    <DirectInput>$sql._sql</DirectInput>
                </ExecuteSQL>
~*/
    }
    var naturalKeys = [], 
        surrogateKeys = [], 
        metadata = [],
        others = [];
    
    while(map = load.nextMap()) {
        switch (map.as) {
            case 'natural key':
                naturalKeys.push(map);
                break;
            case 'surrogate key':
                surrogateKeys.push(map);
                break;
            case 'metadata':
                metadata.push(map);
                break;
            default:
                others.push(map);
        }
    }    

    var attributeMappings = [];
    var historizedAttributesExist = false;
    if(load.toAnchor()) {
        while(map = load.nextMap()) {
            if(map.toAttribute()) {
                var otherMap;
                var attributeMnemonic = map.target.match(/^(..\_...)\_.*/)[1];
                for(i = 0; otherMap = others[i]; i++) {
                    if(otherMap.target == attributeMnemonic + '_ChangedAt') {
                        map.isHistorized = true;
                        historizedAttributesExist = true;
                    }
                }
                attributeMappings.push(map);
            }
        }
    }

    if(attributeMappings.length > 0) {
/*~
                <ExecuteSQL Name="Disable triggers and constraints" ConnectionName="$VARIABLES.TargetDatabase">
                    <DirectInput>
~*/
        for(i = 0; map = attributeMappings[i]; i++) {
/*~
                    DISABLE TRIGGER ALL ON [${VARIABLES.TargetSchema}$].[${map.target}$];
                    ALTER TABLE [${VARIABLES.TargetSchema}$].[${map.target}$] NOCHECK CONSTRAINT ALL;
~*/
        }
/*~
                    </DirectInput>
                </ExecuteSQL>
~*/        
    }
/*~
                <Dataflow Name="Load">
                    <Transformations>
~*/
    var commaStr = ',',
        andStr = 'AND';

    var loadingSQL = load._load ? load._load : "SELECT * FROM " + load.source;
    if(naturalKeys.length == 0 && surrogateKeys.length == 0) {
/*~
                        <OleDbSource Name="$load.source" ConnectionName="$VARIABLES.SourceDatabase">
                            <DirectInput>$loadingSQL</DirectInput>
                        </OleDbSource>
~*/
    }
    else if(naturalKeys.length > 0 && load.toAnchor()) {
/*~
                        <OleDbSource Name="$load.source" ConnectionName="$VARIABLES.SourceDatabase">
                            <DirectInput>
                                DECLARE @known INT = 0;
                                MERGE [${VARIABLES.TargetDatabase}$].[${VARIABLES.TargetSchema}$].[${load.targetTable}$] [${load.anchorMnemonic}$]
                                USING (
                                    SELECT
                                        l.${load.anchorMnemonic}$_ID,
~*/
        while(map = load.nextMap()) {
            commaStr = load.hasMoreMaps() ? ',' : '';
/*~
                                        t.${map.source + commaStr}$
~*/
        }
/*~
                                    FROM (
                                        $loadingSQL
                                    ) t
                                    LEFT JOIN
                                        [${VARIABLES.TargetDatabase}$].[${VARIABLES.TargetSchema}$].[${load.target}$] l
                                    ON
~*/
        for(i = 0; map = naturalKeys[i]; i++) {
            andStr = naturalKeys[i+1] ? 'AND' : '';
/*~            
                                        t.$map.source = l.$map.target $andStr
~*/
        }
/*~
                                ) src
                                ON
                                    src.${load.anchorMnemonic}$_ID = [${load.anchorMnemonic}$].${load.anchorMnemonic}$_ID
~*/
        if(metadata[0]) {
/*~                                    
                                WHEN NOT MATCHED THEN 
                                INSERT ( Metadata_${load.anchorMnemonic}$ )
                                VALUES ( src.${metadata[0].source}$ )
~*/
        }
/*~
                                WHEN MATCHED THEN 
                                UPDATE SET @known = @known + 1
                                OUTPUT
                                    isnull(src.${load.anchorMnemonic}$_ID, inserted.${load.anchorMnemonic}$_ID) as ${load.anchorMnemonic}$_ID,
~*/
        var uniqueSourceColumns = [];
        while(map = load.nextMap()) {
            if(uniqueSourceColumns.indexOf(map.source) < 0) {
                uniqueSourceColumns.push(map.source);
/*~
                                    src.$map.source,
~*/
            }
        }
        if(!metadata[0]) {
/*~
                                    0 as Metadata_${load.anchorMnemonic}$,
~*/            
        }
/*~                                    
                                    left($$action, 1) as Operation;
                            </DirectInput>
                        </OleDbSource>
~*/
    }
    else if(surrogateKeys.length > 0 && load.toAnchor()) {
/*~
                        <OleDbSource Name="$load.source" ConnectionName="$VARIABLES.SourceDatabase">
                            <DirectInput>
                                DECLARE @known INT = 0;
                                MERGE [${VARIABLES.TargetDatabase}$].[${VARIABLES.TargetSchema}$].[${load.targetTable}$] [${load.anchorMnemonic}$]
                                USING (
                                    $loadingSQL
                                ) src
                                ON
                                    src.${surrogateKeys[0].source}$ = [${load.anchorMnemonic}$].${surrogateKeys[0].target}$
~*/
        if(metadata[0]) {
/*~                                    
                                WHEN NOT MATCHED THEN 
                                INSERT ( Metadata_${load.anchorMnemonic}$ )
                                VALUES ( src.${metadata[0].source}$ )
~*/
        }
/*~
                                WHEN MATCHED THEN 
                                UPDATE SET @known = @known + 1
                                OUTPUT
                                    isnull(src.${surrogateKeys[0].source}$, inserted.${load.anchorMnemonic}$_ID) as ${load.anchorMnemonic}$_ID,
~*/
        var uniqueSourceColumns = [];
        while(map = load.nextMap()) {
            if(uniqueSourceColumns.indexOf(map.source) < 0 && surrogateKeys.indexOf(map) < 0) {
                uniqueSourceColumns.push(map.source);
/*~
                                    src.$map.source,
~*/
            }
        }
        if(!metadata[0]) {
/*~
                                    0 as Metadata_${load.anchorMnemonic}$,
~*/            
        }
/*~
                                    left($$action, 1) as Operation;
                            </DirectInput>
                        </OleDbSource>
~*/        
    }

    if(attributeMappings.length > 0) {
/*~                       
                        <ConditionalSplit Name="Known_Unknown">
                            <OutputPaths>
                                <OutputPath Name="Known">
                                    <Expression>[Operation]=="U"</Expression>
                                </OutputPath>
                                <OutputPath Name="Unknown">
                                    <Expression>[Operation]=="I"</Expression>
                                </OutputPath>
                            </OutputPaths>
                        </ConditionalSplit>
~*/
        if(historizedAttributesExist) {
/*~                        
                        <Multicast Name="Split_Known">
                            <OutputPaths> 
~*/
            for(i = 0; map = attributeMappings[i]; i++) {
                if(map.isHistorized) {
/*~
                                <OutputPath Name="$map.target"/> 
~*/
                }
            }
/*~
                            </OutputPaths>
                            <InputPath OutputPathName="Known_Unknown.Known" />
                        </Multicast>
~*/
            for(i = 0; map = attributeMappings[i]; i++) {
                var attributeMnemonic = map.target.match(/^(..\_...)\_.*/)[1];
                if(map.isHistorized) {
/*~
                        <OleDbDestination Name="${map.target}$__Known" ConnectionName="$VARIABLES.TargetDatabase" CheckConstraints="false" UseFastLoadIfAvailable="true" TableLock="true">
                            <ErrorHandling ErrorRowDisposition="IgnoreFailure" TruncationRowDisposition="FailComponent" />
                            <ExternalTableOutput Table="[${VARIABLES.TargetSchema}$].[${map.target}$]" />
                            <InputPath OutputPathName="Split_Known.$map.target" />
                            <Columns>
                                <Column SourceColumn="${load.anchorMnemonic}$_ID" TargetColumn="${attributeMnemonic}$_${load.anchorMnemonic}$_ID" />
~*/
                    var attributeMap;
                    while(attributeMap = load.nextMap()) {
                        if(attributeMap.target.indexOf(attributeMnemonic) >= 0) {
/*~
                                <Column SourceColumn="$attributeMap.source" TargetColumn="$attributeMap.target" />
~*/                            
                        }
                    }
                    if(!metadata[0]) {
/*~
                                <Column SourceColumn="Metadata_${load.anchorMnemonic}$" TargetColumn="Metadata_${attributeMnemonic}$" />
~*/                                                        
                    }
/*~                                
                            </Columns>
                        </OleDbDestination>
~*/
                }
            }
        } // end of if historized attributes exist
/*~                        
                        <Multicast Name="Split_Unknown">
                            <OutputPaths> 
~*/
        for(i = 0; map = attributeMappings[i]; i++) {
/*~
                                <OutputPath Name="$map.target"/> 
~*/
        }
/*~
                            </OutputPaths>
                            <InputPath OutputPathName="Known_Unknown.Unknown" />
                        </Multicast>
~*/
        for(i = 0; map = attributeMappings[i]; i++) {
            var attributeMnemonic = map.target.match(/^(..\_...)\_.*/)[1];
/*~
                        <OleDbDestination Name="${map.target}$__Unknown" ConnectionName="$VARIABLES.TargetDatabase" CheckConstraints="false" UseFastLoadIfAvailable="true" TableLock="true">
                            <ErrorHandling ErrorRowDisposition="FailComponent" TruncationRowDisposition="FailComponent" />
                            <ExternalTableOutput Table="[${VARIABLES.TargetSchema}$].[${map.target}$]" />
                            <InputPath OutputPathName="Split_Unknown.$map.target" />
                            <Columns>
                                <Column SourceColumn="${load.anchorMnemonic}$_ID" TargetColumn="${attributeMnemonic}$_${load.anchorMnemonic}$_ID" />
~*/
            var attributeMap;
            while(attributeMap = load.nextMap()) {
                if(attributeMap.target.indexOf(attributeMnemonic) >= 0) {
/*~
                                <Column SourceColumn="$attributeMap.source" TargetColumn="$attributeMap.target" />
~*/                            
                }
            }
            if(!metadata[0]) {
/*~
                                <Column SourceColumn="Metadata_${load.anchorMnemonic}$" TargetColumn="Metadata_${attributeMnemonic}$" />
~*/                                                        
            }
/*~                                
                            </Columns>
                        </OleDbDestination>
~*/
        }
    } // end of if attributes exist
/*~
                    </Transformations>
                </Dataflow>
~*/
    if(attributeMappings.length > 0) {
/*~
                <ExecuteSQL Name="Enable triggers and constraints" ConnectionName="$VARIABLES.TargetDatabase">
                    <DirectInput>
~*/
        for(i = 0; map = attributeMappings[i]; i++) {
/*~
                    ENABLE TRIGGER ALL ON [${VARIABLES.TargetSchema}$].[${map.target}$];
                    ALTER TABLE [${VARIABLES.TargetSchema}$].[${map.target}$] WITH NOCHECK CHECK CONSTRAINT ALL;
~*/
        }
/*~
                    </DirectInput>
                </ExecuteSQL>
~*/        
    }
    if(sql = load.sql ? load.sql.after : null) {
/*~
                <ExecuteSQL Name="SQL After" ConnectionName="$VARIABLES.SourceDatabase">
                    <DirectInput>$sql._sql</DirectInput>
                </ExecuteSQL>
~*/
    }
/*~
            </Tasks>
        </Package>
~*/
}
/*~
    </Packages>
</Biml>
~*/
